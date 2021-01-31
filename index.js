'use strict'
const { execFile } = require('child_process')

class ServerlessPlugin {
  constructor (serverless, options) {
    this.serverless = serverless
    this.options = options
    this.variableResolvers = {
      '1password': this.onePassword
    }
  }

  onePassword (params) {
    const opargs = prepareInvocation(params)
    const requestType = opargs[1]
    return new Promise((resolve, reject) => {
      execFile('op', opargs, (err, data, stderr) => {
        if (err) {
          reject(new Error('1password: ' + stderr.trim()))
        } else {
          if (requestType === 'item') {
            resolve(JSON.parse(data))
          } else {
            resolve(data)
          }
        }
      })
    })
  }
}

function prepareInvocation (params) {
  params = params.slice('1password:'.length).replace(/^'/, '').replace(/'$/, '')
  let config = {
    fields: 'username,password',
    raw: false
  }

  /* Split at :, unless it's escaped */
  const quotedSegments = params.match(/(\\.|[^:])+/g)
  const segments = quotedSegments.map(n => n.replace(/\\:/g, ':'))
  const item = segments.pop()
  let opargs
  if (segments.length) {
    config = Object.assign(config, parseKv(segments))
  }

  if (config.document) {
    opargs = [
      'get',
      'document',
      item
    ]
  } else if (config.totp) {
    opargs = [
      'get',
      'totp',
      item
    ]
  } else {
    opargs = [
      'get',
      'item',
      item,
      '--format',
      'JSON'
    ]

    if (config.raw === false) {
      opargs.push(...[
        '--fields',
        config.fields
      ])
    }
  }
  if (config.vault) {
    opargs.push(...[
      '--vault',
      config.vault
    ])
  }
  if (config.account) {
    opargs.push(...['--account', config.account])
  }

  return (opargs)
}

function parseKv (input) {
  const output = {}
  for (const segment of input) {
    const eq = segment.indexOf('=')
    if (eq > -1) {
      output[segment.slice(0, eq)] = segment.slice(eq + 1)
    } else {
      output[segment] = true
    }
  }
  return (output)
}

module.exports = ServerlessPlugin
