// You can import your modules
// import index from '../src/index'

import nock from 'nock'
// Requiring our app implementation
const myProbotApp = require('../src')
const { Probot, ProbotOctokit } = require('probot')

nock.disableNetConnect()

describe('Autoapproval bot', () => {
  let probot: any

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'test',
      // Disable throttling & retrying requests for easier testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false }
      })
    })
    myProbotApp(probot)
  })

  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })

  test('PR has missing ignored_labels -> will be approved', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels:\n  - merge\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR has ignored labels -> will NOT be approved', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels:\n  - merge\nignored_labels:\n  - wip\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR has no required labels -> will NOT be approved', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels:\n  - ready\nignored_labels: []\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR has not all required labels -> will NOT be approved', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels:\n  - ready\n  - ready2\nignored_labels: []\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR has no expected owner -> will NOT be approved', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - blabla\nrequired_labels:\n  - merge\nignored_labels: []\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR has required labels and expected owner -> will be approved', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels:\n  - merge\nignored_labels: []\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR has multiple required labels and expected owner -> will be approved', async () => {
    const payload = require('./fixtures/pull_request_opened_multiple_labels.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels:\n  - merge\n  - merge2\nignored_labels: []\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_multiple_labels.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR has one of multiple required labels and expected owner -> will be approved', async () => {
    const payload = require('./fixtures/pull_request_opened_multiple_labels.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels:\n  - merge\n  - merge2\nrequired_labels_mode: one_of\nignored_labels: []\napply_labels: []'
    const prInfo = require('./fixtures/pull_request_multiple_labels.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR approved and label is applied', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels: []\nignored_labels: []\napply_labels:\n  - done'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/issues/1/labels', (body: any) => {
        return body.labels.includes('done')
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR approved and auto merge is enabled', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels: []\nignored_labels: []\napply_labels: []\nauto_merge_labels:\n  - merge'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.pullRequestId === 'MDExOlB1bGxSZXF1ZN0NjExMzU2MTgy' &&
          body.variables.mergeMethod === 'MERGE'
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR approved and auto merge squash is enabled', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels: []\nignored_labels: []\napply_labels: []\nauto_squash_merge_labels:\n  - merge'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.pullRequestId === 'MDExOlB1bGxSZXF1ZN0NjExMzU2MTgy' &&
          body.variables.mergeMethod === 'SQUASH'
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR approved and auto merge rebase is enabled', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels: []\nignored_labels: []\napply_labels: []\nauto_rebase_merge_labels:\n  - merge'
    const prInfo = require('./fixtures/pull_request_reviews_empty.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.pullRequestId === 'MDExOlB1bGxSZXF1ZN0NjExMzU2MTgy' &&
          body.variables.mergeMethod === 'REBASE'
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR is already approved -> will NOT be approved again', async () => {
    const payload = require('./fixtures/pull_request.opened.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels: []\nignored_labels: []\napply_labels:\n  - merge'
    const prInfo = require('./fixtures/pull_request_reviews.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request_review', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('Autoapproval review was dismissed -> approve PR again', async () => {
    const payload = require('./fixtures/pull_request_review.dismissed.json')
    const config = 'from_owner:\n  - dkhmelenko\nrequired_labels: []\nignored_labels: []\napply_labels:\n  - merge'
    const prInfo = require('./fixtures/pull_request_reviews_dismissed.json')

    nock('https://api.github.com')
      .get('/repos/dkhmelenko/autoapproval/contents/.github%2Fautoapproval.yml')
      .reply(200, config)

    nock('https://api.github.com')
      .post('/graphql', (body: any) => {
        return body.variables.owner === 'dkhmelenko' &&
          body.variables.repoName === 'autoapproval' &&
          body.variables.prNumber === 1
      })
      .reply(200, prInfo)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/pulls/1/reviews', (body: any) => {
        return body.event === 'APPROVE'
      })
      .reply(200)

    nock('https://api.github.com')
      .post('/repos/dkhmelenko/autoapproval/issues/1/labels', (body: any) => {
        return body.labels.includes('merge')
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'pull_request_review', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })

  test('PR labeled when opening -> label event is ignored', async () => {
    const payload = require('./fixtures/pull_request.labeled.on_open.json')

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload })

    await new Promise(process.nextTick) // Don't assert until all async processing finishes
    expect(nock.isDone()).toBeTruthy()
  })
})

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about using TypeScript in your tests, Jest recommends:
// https://github.com/kulshekhar/ts-jest

// For more information about testing with Nock see:
// https://github.com/nock/nock
