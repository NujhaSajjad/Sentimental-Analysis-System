Relative path: backend\node_modules\postgres-bytea\readme.md
================================================================================

# postgres-bytea [![Build Status](https://travis-ci.org/bendrucker/postgres-bytea.svg?branch=master)](https://travis-ci.org/bendrucker/postgres-bytea)

> Postgres bytea parser


## Install

```
$ npm install --save postgres-bytea
```


## Usage

```js
var bytea = require('postgres-bytea');
bytea('\\000\\100\\200')
//=> buffer
```

## API

#### `bytea(input)` -> `buffer`

##### input

*Required*  
Type: `string`

A Postgres bytea binary string.

## License

MIT © [Ben Drucker](http://bendrucker.me)
