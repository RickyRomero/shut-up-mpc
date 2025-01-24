import * as dotenv from 'dotenv'
import fetch from 'node-fetch'
import * as fs from 'node:fs/promises'
import path from 'path'
import { promisify } from 'util'
import { __dirname } from './dirname-shim.js'
import pathConfig from './paths.json' with { type: 'json' }

dotenv.config()
const pause = promisify(setTimeout)
const statusCheckLimit = 6

// Returns an operation ID if successful
const uploadPayload = async ({ apiKey, clientId }) => {
  const payloadPath = path.resolve(__dirname, pathConfig.artifactsDir, 'Shut Up.zip')

  try {
    await fs.access(payloadPath, fs.constants.F_OK)
  } catch (e) {
    console.dir(e)
    console.error("Built file not present for upload. Can't continue.")
    process.exit(1)
  }

  console.log('Uploading payload...')
  const archiveHandle = await fs.open(payloadPath)
  const server = process.env.MPC_API_SERVER
  const endpoint = `v1/products/${process.env.MPC_PRODUCT_ID}/submissions/draft/package`
  const response = await fetch(`${server}/${endpoint}`, {
    method: 'POST',
    body: archiveHandle.createReadStream(payloadPath),
    headers: {
      authorization: `ApiKey ${apiKey}`,
      'x-clientid': clientId,
      'content-type': 'application/zip'
    }
  })

  if (response.status !== 202) {
    console.error('The server failed to receive the upload.')
    process.exit(1)
  } else {
    console.log('Uploaded successfully.')

    // Operation ID is returned as Location header
    return response.headers.get('Location')
  }
}

const checkOperation = async (type, { apiKey, clientId, id }) => {
  const operationString = type === 'payload' ? 'payload processing' : 'submission'
  const apiSelection = type === 'payload' ? 'draft/package/operations' : 'operations'

  console.log(`Checking ${operationString} status...`)
  const server = process.env.MPC_API_SERVER
  const endpoint = `/v1/products/${process.env.MPC_PRODUCT_ID}/submissions/${apiSelection}/${id}`
  const response = await fetch(`${server}/${endpoint}`, {
    headers: {
      authorization: `ApiKey ${apiKey}`,
      'x-clientid': clientId,
    }
  })

  const body = await response.json()
  return body
}

const monitorOperation = async (type, { apiKey, clientId, id }) => {
  let checkCount = 0
  let result = {}
  let status = 'InProgress'

  // Wait for our operation's status to come back
  while (status === 'InProgress' && checkCount <= statusCheckLimit) {
    const delay = Math.max(10, 1000 * Math.pow(2, checkCount))
    console.log(`Awaiting result. Next check in ${delay / 1000} seconds...`)
    await pause(delay)

    result = await checkOperation(type, { apiKey, clientId, id })
    status = result.status
    checkCount += 1
  }

  if (status !== 'Succeeded') {
    console.error('The operation failed or timed out on the receiving server.')
    console.dir({ checkCount, result })
    process.exit(1)
  } else {
    console.log('Operation succeeded.')
  }
}

const draftSubmission = async ({ apiKey, clientId }) => {
  const notesPath = path.resolve(__dirname, './reviewer-notes.txt')
  const reviewerNotes = (await fs.readFile(notesPath, { encoding: 'utf8' })).trim()

  console.log('Drafting submission...')
  const server = process.env.MPC_API_SERVER
  const endpoint = `v1/products/${process.env.MPC_PRODUCT_ID}/submissions`
  const response = await fetch(`${server}/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({ notes: reviewerNotes }),
    headers: {
      authorization: `ApiKey ${apiKey}`,
      'x-clientid': clientId,
      'content-type': 'application/json; charset=utf-8'
    }
  })

  if (response.status !== 202) {
    console.error('The server failed to draft the submission.')
    process.exit(1)
  } else {
    console.log('Submission drafted successfully.')

    // Operation ID is returned as Location header
    return response.headers.get('Location')
  }
}

const submitNewVersion = async () => {
  const apiKey = process.env.MPC_API_KEY
  const clientId = process.env.MPC_CLIENT_ID

  const payloadId = await uploadPayload({ apiKey, clientId })
  await monitorOperation('payload', { apiKey, clientId, id: payloadId })

  const submissionId = await draftSubmission({ apiKey, clientId })
  await monitorOperation('submission', { apiKey, clientId, id: submissionId })
}

submitNewVersion()
