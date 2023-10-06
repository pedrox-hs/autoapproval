import * as core from '@actions/core'
import { Context, Probot } from 'probot'

type ReviewInfo = {
  user: string
  state: string
}

type PullRequestInfo = {
  id: string
  url: string
  owner: string
  repo: string

  author: string
  number: number
  labels: string[]
  reviews: ReviewInfo[]
}

module.exports = (app: Probot) => {
  app.onAny(async (context) => {
    const payloadAction = 'action' in context.payload ? context.payload.action : 'none'
    app.log.debug({ event: context.name, action: payloadAction })
  })

  app.on(
    ['pull_request.opened', 'pull_request.reopened', 'pull_request.ready_for_review', 'pull_request.labeled', 'pull_request.edited', 'pull_request_review', 'workflow_run'],
    async (context) => {
      const pr = 'pull_request' in context.payload ? context.payload.pull_request : undefined
      const prNumber = core.getInput('pr_number') || pr?.number
      const repository = core.getInput('repository') || context.payload.repository.full_name

      if (!prNumber) {
        core.setFailed('No PR number found')
        return
      }

      // NOTE(dabrady) When a PR is first opened, it can fire several different kinds of events if the author e.g. requests
      // reviewers or adds labels during creation. This triggers parallel runs of our GitHub App, so we need to filter out
      // those simultaneous events and focus just on the re/open event in this scenario.
      //
      // These simultaneous events contain the same pull request data in their payloads, and specify the 'updated at'
      // timestamp to be the same as the 'created at' timestamp for the pull request. We can use this to distinguish events
      // that are fired during creation from events fired later on.
      if (!['opened', 'reopened'].includes(context.payload.action) && pr != null && pr.created_at === pr.updated_at) {
        context.log('Ignoring additional creation event: %s', context.payload.action)
        return
      }

      const pullRequest = await getPullRequestInfo(context, repository, Number(prNumber))
      await handlePullRequest(context, pullRequest)
    }
  )
}

async function handlePullRequest (context: Context, pr: PullRequestInfo) {
  context.log('Repo: %s', pr.repo)
  context.log('PR: %s', pr.url)

  context.log('Event: %s', context.name)
  context.log('Action: %s', 'action' in context.payload ? context.payload.action : 'none')

  // reading configuration
  const config: any = await context.config('autoapproval.yml')
  context.log.debug(config, '\n\nLoaded config')

  // determine if the PR has any "ignored" labels
  let ignoredLabels: string[] = []

  if (config.blacklisted_labels !== undefined) {
    context.log('blacklisted_labels is deprecated, please use ignored_labels instead')
    config.ignored_labels = config.blacklisted_labels
  }

  const prLabels = pr.labels
  if (config.ignored_labels !== undefined) {
    ignoredLabels = config.ignored_labels
      .filter((ignoreLabel: any) => prLabels.includes(ignoreLabel))

    // if PR contains any ignored labels, do not proceed further
    if (ignoredLabels.length > 0) {
      context.log('PR ignored from approving: %s', ignoredLabels)
      return
    }
  }

  // reading pull request owner info and check it with configuration
  const ownerSatisfied = config.from_owner.length === 0 || config.from_owner.includes(pr.author)

  // reading pull request labels and check them with configuration
  let requiredLabelsSatisfied
  if (config.required_labels_mode === 'one_of') {
    // one of the required_labels needs to be applied
    const appliedRequiredLabels = config.required_labels
      .filter((requiredLabel: any) => prLabels.includes(requiredLabel))
    requiredLabelsSatisfied = appliedRequiredLabels.length > 0
  } else {
    // all of the required_labels need to be applied
    const missingRequiredLabels = config.required_labels
      .filter((requiredLabel: any) => !prLabels.includes(requiredLabel))
    requiredLabelsSatisfied = missingRequiredLabels.length === 0
  }

  if (requiredLabelsSatisfied && ownerSatisfied) {
    const reviews = pr.reviews.filter((review: any) => ['autoapproval[bot]', 'github-actions'].includes(review.user))
    let message: string

    if (reviews.length > 0) {
      context.log('PR has already reviews')
      const isDismissed = reviews.filter((review: any) => review.state !== 'APPROVED').length > 0
      if (!isDismissed) return
      message = 'Review was dismissed, approve again'
    } else {
      message = 'PR approved first time'
    }

    await applyAutoMerge(context, pr, config.auto_merge_labels, config.auto_rebase_merge_labels, config.auto_squash_merge_labels)
    await approvePullRequest(context, pr)
    await applyLabels(context, pr, config.apply_labels as string[])

    context.log(message)
  } else {
    // one of the checks failed
    core.setFailed(`
      Condition failed!
      - missing required labels: ${requiredLabelsSatisfied}
      - PR owner found: ${ownerSatisfied}
      `
    )
  }
}

const getPrInfoQuery = `
  query ($owner: String!, $repoName: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repoName) {
      pullRequest(number: $prNumber) {
        id
        url
        author {
          login
        }
        labels(first: 100) {
          nodes {
            name
          }
        }
        reviews(first: 100) {
          nodes {
            author {
              login
            }
            state
          }
        }
      }
    }
  }
`

const enableAutoMergeMutation = `
  mutation($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
    enablePullRequestAutoMerge(input:{
      pullRequestId: $pullRequestId,
      mergeMethod: $mergeMethod
    }) {
      pullRequest {
        id,
        autoMergeRequest {
          mergeMethod
        }
      }
    }
  }
`

async function getPullRequestInfo (context: Context, repository: String, number: number): Promise<PullRequestInfo> {
  const [owner, repo] = repository.split('/')
  const prInfo: any = await context.octokit.graphql(getPrInfoQuery, {
    owner,
    repoName: repo,
    prNumber: number
  })

  const pr = prInfo.repository.pullRequest
  const labels = pr.labels.nodes.map((label: any) => label.name)
  const reviews = pr.reviews.nodes.map(
    (review: any) => {
      return {
        user: review.author.login,
        state: review.state
      }
    }
  )

  return {
    id: pr.id,
    url: pr.url,
    author: pr.author.login,
    number,
    owner,
    repo,
    labels,
    reviews
  }
}

async function approvePullRequest (context: Context, pr: PullRequestInfo) {
  const prParams = context.pullRequest({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
    event: 'APPROVE' as const,
    body: 'Approved :+1:'
  })
  await context.octokit.pulls.createReview(prParams)
}

async function applyLabels (context: Context, pr: PullRequestInfo, labels: string[]) {
  // if there are labels required to be added, add them
  const labelsToApply = labels.filter((label: string) => !pr.labels.includes(label))
  if (labelsToApply.length > 0) {
    // trying to apply existing labels to PR. If labels didn't exist, this call will fail
    const labelsParam = context.issue({ labels: labelsToApply, pull_number: pr.number })
    try {
      await context.octokit.issues.addLabels(labelsParam)
    } catch (error) {
      context.log.error('Failed to apply labels: %s', error)
    }
  }
}

async function applyAutoMerge (context: Context, pr: PullRequestInfo, mergeLabels: string[], rebaseLabels: string[], squashLabels: string[]) {
  const prLabels = pr.labels

  let automergeMethod = mergeLabels && mergeLabels.some((label: string) => prLabels.includes(label)) ? 'MERGE' : undefined
  automergeMethod = rebaseLabels && rebaseLabels.some((label: string) => prLabels.includes(label)) ? 'REBASE' : automergeMethod
  automergeMethod = squashLabels && squashLabels.some((label: string) => prLabels.includes(label)) ? 'SQUASH' : automergeMethod

  if (automergeMethod) {
    await enableAutoMerge(context, pr, automergeMethod)
  }
}

async function enableAutoMerge (context: Context, pr: PullRequestInfo, method: string) {
  context.log.info('Auto merging with merge method %s', method)

  await context.octokit.graphql(enableAutoMergeMutation, {
    pullRequestId: pr.id,
    mergeMethod: method
  })
}
