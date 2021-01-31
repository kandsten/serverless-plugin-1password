# serverless-plugin-1password

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Description
This plugin for the [Serverless framework](http://www.serverless.com/) provides 
access to secrets stored in [1Password](https://1password.com/). Behind the scenes, it uses the 
[1Password CLI](https://support.1password.com/command-line-getting-started/) to
communicate with 1Password.

## Prerequisites
The [1Password Command Line Tool](https://support.1password.com/command-line-getting-started/) must be installed and functional. The plugin has been tested with v1.8.0, but slightly older versions are also likely to work.

## Installation
Run `npm install` in your Serverless project:

```
$ npm install --save-dev serverless-plugin-1password
```

Add the plugin to your serverless.yml file:
```yml
plugins:
  - serverless-plugin-1password
```

## Usage
Access 1Password items via Serverless variables:

```
custom:
  IdpCredentials: ${1password:'Microsoft IDP credentials'}
```

...which can then be accessed elsewhere in your serverless config:

```
Type: AWS::Cognito::UserPoolIdentityProvider
Properties:
  UserPoolId: !Ref CognitoUserPoolUsers
  ProviderName: Microsoft
  ProviderType: OIDC
  ProviderDetails:
    client_id: ${self:custom.IdpCredentials.username}
    client_secret: ${self:custom.IdpCredentials.password}
  [...]
```

The default fields returned are `username` and `password`. For other fields, see the `fields` argument, below.

### Arguments
Supply arguments to the plugin by prepending them to the item. Anything after the last (non-quoted) colon will be considered to be the requested item; anything prior to it is considered to be arguments.

```
${1password:'argument1:argument2=value:test item'}
```

#### Available arguments

 * `fields` - a comma separated list of field names to retrieve from the item. Any non existent fields will be returned as empty.
    ```
    ${1password:'fields=public key,private key:MyService RSA keypair'}
    ```
 * `vault` - the vault to search for the given item in. If omitted, 1Password will search all vaults in the account.
    ```
    ${1password:'vault=MyService development:MyService RSA keypair'}
    ```
 * `raw` (bool) - return the raw JSON record for the entire item. May be a bit tricky to use effectively.
    ```
    ${1password:'raw:My login'}
    ```
 * `totp` (bool) - Return the [TOTP](https://en.wikipedia.org/wiki/Time-based_One-Time_Password) code from this item. Ignores `raw` and `fields`.
    ```
    ${1password:'totp:My login'}
    ```
 * `document` (bool) - Fetch a document rather than an item. Ignores `raw` and `fields`. Returns the raw document rather than JSON. **Will only support utf-8 content**, not arbitrary binary data.
    ```
    ${1password:'document:vault=MyService:JWT signing key'}
    ```
 * `account` - Account shorthand for 1Password; see the [1Password CLI documentation](https://support.1password.com/command-line/#sign-in-or-out) for details.
    ```
    ${1password:'account=myacct.1password.com:My login'}
    ```

> **A note on quoting** - Serverless variables are parsed in a fairly complex manner. If any part of your 1password invocation - field names or item names - contains either spaces or commas, you must quote the string.
> 
> To retain sanity, quote the entire string.
>
> These will break:
>  ```
>   ${1password:Test item}
>   ${1password:Item, test}
>   ${1password:vault=Top secret:TestItem}
>   ${1password:vault=Secrets,Top:TestItem}
>   ```
> 
> These will work:
>  ```
>   ${1password:'Test item'}
>   ${1password:'Item, test'}
>   ${1password:'vault=Top secret:TestItem'}
>   ${1password:'vault=Secrets,Top:TestItem'}
>   ```
>
> Additionally, you must quote colons in your
> item names or arguments. This will return 
> fields from an item named `Test: the item`
> ```
>   ${1password:'Test\: the item'}
> ```


## Authors and acknowledgment
* Written by Kriss Andsten <kriss@ekkono.ai>
* [Ekkono Solutions](https://www.ekkono.ai) sponsored parts of the development time for this plugin.

## Contributing
Feel free to [raise issues](https://github.com/kandsten/serverless-plugin-1password/issues) and/or send in pull requests.

The general idea is to keep this plugin lightweight; will consider features if they support current or future 1Password and/or Serverless features.

Please do not introduce third party runtime dependencies.

## License
### Internet Systems Consortium license

Copyright (c) `2021`, `Kriss Andsten`

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.


## Implementation notes

### Security considerations
Given that the plugin is intended to handle secrets, some care was taken:
* No external dependencies. I don't plan on introducing any.
* When invoking `op`, the plugin doesn't pass data through the shell.
* The plugin doesn't do anything destructive; strictly read only.
* Any fields (beyond the default `username,password`) need to be explicitly exported,
limiting accidental exposure.

### 1Password gotchas
* Field names in 1Password can contain commas, but it's impossible to retrieve these using `op`.
