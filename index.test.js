const Serverless = require('serverless/lib/Serverless')
const rewire = require('rewire')
const op = require('./index')
const opRewire = rewire('./index')
const child_process = require('child_process')
jest.mock('child_process')

describe('Serveless tests', () => {
  const sls = new Serverless()
  sls.pluginManager.addPlugin(op)
  // Workaround for https://github.com/facebook/jest/issues/2235
  beforeAll(async () => {
    await sls.init()
  })
  let response
  let opitem
  child_process.execFile.mockImplementation(
    (command, args, callback) => {
      // get item <item> ...
      if (args[2] == opitem) {
        callback(...response)
      } else {
        throw `Unexpected item ${args[2]} requested, expected ${opitem}`
      }
    }
  )

  /*
        Various permutations of "Get me an item", mainly
        intended to make sure that we don't get butchered
        by Serverless. Also ensure that we're fetching the
        expected 1Password item - if this works properly,
        arguments will likely also get through without
        quoting issues.

        Since the output is passed on verbatim from op
        to Serverless, no point in testing that bit
        a whole lot.
    */
  const tgt = { username: 'test', password: 'test' }
  response = successResponse(JSON.stringify(tgt))
  test('Unquoted item name', async () => {
    sls.service.custom.testVar = '${1password:test}'
    opitem = 'test'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('Quoted item name', async () => {
    sls.service.custom.testVar = "${1password:'test'}"
    opitem = 'test'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('Comma in item name', async () => {
    sls.service.custom.testVar = "${1password:'one,two'}"
    opitem = 'one,two'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('Space in item name', async () => {
    sls.service.custom.testVar = "${1password:'one two'}"
    opitem = 'one two'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('Colon in item name', async () => {
    sls.service.custom.testVar = "${1password:'one\\:colon'}"
    opitem = 'one:colon'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('Colon in item name, colon in arguments', async () => {
    sls.service.custom.testVar = "${1password:'te\\:st:one\\:colon'}"
    opitem = 'one:colon'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('Empty arguments string', async () => {
    sls.service.custom.testVar = "${1password:':test'}"
    opitem = 'test'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('With vault', async () => {
    sls.service.custom.testVar = "${1password:'vault=Testing:Test item'}"
    opitem = 'Test item'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('Raw content', async () => {
    sls.service.custom.testVar = "${1password:'raw:Raw item'}"
    opitem = 'Raw item'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('With fields', async () => {
    sls.service.custom.testVar = "${1password:'fields=username,test,password:test'}"
    opitem = 'test'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })
  test('With account', async () => {
    sls.service.custom.testVar = "${1password:'account=test:test'}"
    opitem = 'test'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(tgt)
  })

  /*
        `document` and `totp` are supposed to be returned verbatim,
        not as objects.
    */
  test('Document', async () => {
    const fileContents = 'Test file content☃️'
    response = successResponse(fileContents)
    sls.service.custom.testVar = "${1password:'document:test'}"
    opitem = 'test'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(fileContents)
  })

  test('TOTP', async () => {
    const fileContents = '123456'
    response = successResponse(fileContents)
    sls.service.custom.testVar = "${1password:'totp:test'}"
    opitem = 'test'
    await sls.variables.populateService()
    expect(sls.variables.service.custom.testVar).toEqual(fileContents)
  })

  /*
        Make sure that we bubble any errors that `op` gives us
    */
  test('Error message bubbling up', async () => {
    sls.service.custom.testVar = '${1password:test}'
    opitem = 'test'
    response = failureResponse('Not logged in')
    return expect(sls.variables.populateService()).rejects.toMatchObject(Error('1password: Not logged in'))
  })
})

/*
    Some sanity checks as we do our own KV parsing
*/
describe('KV parser unit tests', () => {
  const parseKv = opRewire.__get__('parseKv')
  test('Single key', () => {
    expect(parseKv(['foo'])).toEqual({
      foo: true
    })
  })
  test('Single keyval', () => {
    expect(parseKv(['foo=bar'])).toEqual({
      foo: 'bar'
    })
  })
  test('Multiple keys', () => {
    expect(parseKv(['foo', 'bar', 'baz'])).toEqual({
      foo: true,
      bar: true,
      baz: true
    })
  })
  test('Multiple keyvals', () => {
    expect(parseKv(['foo=bar', 'bar=baz'])).toEqual({
      foo: 'bar',
      bar: 'baz'
    })
  })
  test('Value containing :', () => {
    expect(parseKv(['foo=b:ar', 'baz=baz'])).toEqual({
      foo: 'b:ar',
      baz: 'baz'
    })
  })
  test('Value containing =', () => {
    expect(parseKv(['foo=b=ar', 'baz=baz'])).toEqual({
      foo: 'b=ar',
      baz: 'baz'
    })
  })
  test('Value beginning with =', () => {
    expect(parseKv(['foo==test'])).toEqual({
      foo: '=test'
    })
  })
  test('Empty input', () => {
    expect(parseKv([])).toEqual({})
  })
})

/*

*/
describe('Query prep unit tests', () => {
  const prepareInvocation = opRewire.__get__('prepareInvocation')
  test('No arguments', () => {
    expect(prepareInvocation('1password:test')).toEqual([
      'get',
      'item',
      'test',
      '--format',
      'JSON',
      '--fields',
      'username,password'
    ])
  })
  test('Bogus argument', () => {
    expect(prepareInvocation('1password:foo:test')).toEqual([
      'get',
      'item',
      'test',
      '--format',
      'JSON',
      '--fields',
      'username,password'
    ])
  })
  test('Empty argument string', () => {
    expect(prepareInvocation('1password::test')).toEqual([
      'get',
      'item',
      'test',
      '--format',
      'JSON',
      '--fields',
      'username,password'
    ])
  })
  test('With vault', () => {
    expect(prepareInvocation('1password:vault=Test vault:test')).toEqual([
      'get',
      'item',
      'test',
      '--format',
      'JSON',
      '--fields',
      'username,password',
      '--vault',
      'Test vault'
    ])
  })
  test('Whitespace in item name', () => {
    expect(prepareInvocation('1password:this is a test')).toEqual([
      'get',
      'item',
      'this is a test',
      '--format',
      'JSON',
      '--fields',
      'username,password'
    ])
  })
  test('Whitespace in item and field names', () => {
    expect(prepareInvocation('1password:fields=foo bar,baz:this is a test')).toEqual([
      'get',
      'item',
      'this is a test',
      '--format',
      'JSON',
      '--fields',
      'foo bar,baz'
    ])
  })
  test('Document', () => {
    expect(prepareInvocation('1password:fields=foo bar,baz:document:test')).toEqual([
      'get',
      'document',
      'test'
    ])
  })
  test('TOTP', () => {
    expect(prepareInvocation('1password:fields=foo bar,baz:totp:test')).toEqual([
      'get',
      'totp',
      'test'
    ])
  })
  test('Account', () => {
    expect(prepareInvocation('1password:account=TestAcct:test')).toEqual([
      'get',
      'item',
      'test',
      '--format',
      'JSON',
      '--fields',
      'username,password',
      '--account',
      'TestAcct'
    ])
  })
})

function successResponse (target) {
  return ([false, target, ''])
}

function failureResponse (target) {
  return ([true, '', target])
}
