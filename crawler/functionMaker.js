var crawl = require('./crawler');
var _ = require('lodash');
var beautify = require('js-beautify').js_beautify;

function makeArgDesc (arg) {
  var name = arg.isRequired ? ('obj.' + arg.name) : ('[obj.' + arg.name + ']');
  return ' * @param {' + arg.type + '} ' + name + ' ' + arg.description + '\n';
}

function makeDesc (spec) {
  if(!spec.description && !spec.args) return '';
  if(spec.description) {
    if(spec.level) {
      spec.description = spec.description + ' (高级接口)';
    }
    var desc = '* @description ' + spec.description + '\n';
  }
  return '/**\n' + desc + (spec.args || []).map(function(arg){return makeArgDesc(arg);}).join('') + '*/';
}

function makeObj (key, spec) {
  var comment = makeDesc(spec);
  var start = key ? (comment + _.camelCase(key) + ':') : '';
  if(spec.children) {
    var body = '';
    for(var childKey in spec.children) {
      body += makeObj(childKey, spec.children[childKey]);
      body += ',';
    }
    body = body.replace(/,+$/m, '');
    return start + '{' + body + '}';
  } else if (spec.path) {
    return start + makeFunc(spec);
  } else {
    console.log(spec);
    throw new Error('obj without children');
  }
}

function makeFunc (spec) {
  var tokenValidation = '';
  var objDecoration = '_.assign({}, obj';
  if(spec.tokenRequired) {
    tokenValidation = 'if(!opts.accessToken){return Promise.reject("API is not authorized. Access token is required.");}'
    objDecoration += ', {access_token: opts.accessToken}';
  }
  if(spec.appKeyRequired) {
    objDecoration += ', {app_key: opts.appKey}';
  }
  if(spec.appSecretRequired) {
    objDecoration += ', {app_secret: opts.appSecret}';
  }
  if(spec.redirectUriRequired) {
    objDecoration += ', {redirect_uri: opts.redirectUri}';
  }
  objDecoration += ')';
  return 'function(obj){' + tokenValidation + ' var pormise = req(\'' + spec.method + '\', opts.apiServer + \'' + spec.path + '\', ' + objDecoration + '); if(opts.camelCase){return promise.then(function(result){return recursivelyCamelCase(result)});} return promise;}';
}

function recursivelyCamelCase (obj) {
  if (typeof obj !== 'object') return obj;
  var result = _.isArray(obj) ? [] : {};
  for(var key in obj) {
    if(obj.hasOwnProperty(key)) {
      result[_.camelCase(key)] = recursivelyCamelCase(obj[key]);
    }
  }
  return result;
}

crawl().then(function(spec){
  var root = {description: '明道 API', children: spec};
  var apiCode = makeObj(null, root);
  var initCode = '{init: function(){}, setToken: function(){}}';
  var recursivelyCamelCaseCode = recursivelyCamelCase.toString();
  var code = recursivelyCamelCase + apiCode;
  code = beautify(code, { indent_size: 2 });
  console.log(code);
});