import path from 'path'
import * as fs from 'node:fs/promises'
import { promisify } from 'util'
import * as dotenv from 'dotenv'
import fetch from 'node-fetch'
import pathConfig from './paths.json' assert { type: 'json' }
import { __dirname } from './dirname-shim.js'

dotenv.config()
const pause = promisify(setTimeout)
const statusCheckLimit = 5

const refreshToken = async () => {
  const tokenUrl = process.env.MPC_TOKEN_URL
  const params = new URLSearchParams()
  params.append('client_id', process.env.MPC_CLIENT_ID)
  params.append('scope', 'https://api.addons.microsoftedge.microsoft.com/.default')
  params.append('client_secret', process.env.MPC_SECRET)
  params.append('grant_type', 'client_credentials')

  console.log('Updating access token...')
  const response = await fetch(tokenUrl, {
    method: 'POST',
    body: params
  })
  const body = await response.json()

  if (!body.access_token) {
    console.error('Failed to refresh the MPC OAuth token.')
    process.exit(1)
  } else {
    console.log('Successfully updated access token.')
    return body.access_token
  }
}

// Returns an operation ID if successful
const uploadPayload = async accessToken => {
  const payloadPath = path.resolve(__dirname, pathConfig.artifactsDir, 'Shut Up.zip')
  console.log(payloadPath)
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
      authorization: `Bearer ${accessToken}`,
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

const checkOperation = async (type, { accessToken, id }) => {
  const operationString = type === 'payload' ? 'payload processing' : 'submission'
  const apiSelection = type === 'payload' ? 'draft/package/operations' : 'operations'

  console.log(`Checking ${operationString} status...`)
  const server = process.env.MPC_API_SERVER
  const endpoint = `/v1/products/${process.env.MPC_PRODUCT_ID}/submissions/${apiSelection}/${id}`
  const response = await fetch(`${server}/${endpoint}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  })

  const body = await response.json()
  return body
}

const monitorOperation = async (type, { accessToken, id }) => {
  let checkCount = 0
  let result = {}
  let status = 'InProgress'

  // Wait for our payload's status to come back
  while (status === 'InProgress' && checkCount < statusCheckLimit) {
    const delay = Math.max(10, 1000 * Math.pow(2, checkCount))
    console.log(`Awaiting result. Next check in ${delay / 1000} seconds...`)
    await pause(delay)

    result = await checkOperation(type, { accessToken, id })
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

const draftSubmission = async accessToken => {
  const reviewerNotes = (await fs.readFile(
    './reviewer-notes.txt', { encoding: 'utf8' }
  )).trim()

  console.log('Drafting submission...')
  const server = process.env.MPC_API_SERVER
  const endpoint = `v1/products/${process.env.MPC_PRODUCT_ID}/submissions`
  const response = await fetch(`${server}/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({ notes: reviewerNotes }),
    headers: {
      authorization: `Bearer ${accessToken}`,
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
  const accessToken = await refreshToken()
  const payloadId = await uploadPayload(accessToken)
  await monitorOperation('payload', { accessToken, id: payloadId })

  const submissionId = await draftSubmission(accessToken)
  await monitorOperation('submission', { accessToken, id: submissionId })
}

submitNewVersion()
