var cheerio = require('cheerio');
var Promise  = require('bluebird');
var request = Promise.promisify(require('request'));

var makeModulePromise = function(module, path){
  return request('http://open.mingdao.com/ApiDocAjax/GetRightList?module=' + path).then(function(args){
    return JSON.parse(args[1]);
  }).then(function(subPathList) {
    return Promise.all(subPathList.map(function(p){
      var pathArr = p.path.split('/');
      var host = module;
      pathArr.slice(2).forEach(function(frag){
        if(!frag) return;
        if(!host.children) { host.children = {}; }
        if(!host.children[frag]) { host.children[frag] = {}; }
        host = host.children[frag];
      });
      host.path = p.path;
      host.description = p.affect;
      host.level = parseInt(p.level);
      host.args = [];
      host.tokenRequired = false;
      host.appKeyRequired = false;
      host.appSecretRequired = false;
      host.redirectUriRequired = false;
      return request('http://open.mingdao.com/api' + p.src).then(function(args){
        var $ = cheerio.load(args[1]);
        host.method = $('td:contains("HTTP请求方式")').next().text();
        $('td:contains("请求参数")').closest('table').each(function(tableIndex, table){
          var conditialDescription = '';
          if(tableIndex) {
            var $el = $(table);
            while(!($el = $el.prev()).is('table')) {
              var text = $el.text().trim().replace(/\s+/, ' ');
              if(text && text.indexOf('说明') === -1) {
                conditialDescription = ', ' + conditialDescription + text;
              }
            }
          }
          $(table).find('tr').each(function(trIndex, tr) {
            if(trIndex === 0) return;
            var $tds = $(tr).find('td');
            var argName = $($tds[0]).text().trim();
            var argIsRequired = $($tds[1]).text().trim();
            var argType = $($tds[2]).text().trim();
            var argDesc = $($tds[3]).text().trim();

            var match = argType.match(/^([A-Za-z0-9]+),*\s*(.*)/);
            if(match && match[2]) {
              argType = match[1];
              argDesc = match[2] + ', ' + argDesc;
            }
            argType = argType.toLowerCase();
            if(argType === 'int' || argType === 'int32' || argType === 'int64' || argType === 'nt') {
              argType = 'number';
            } else if(argType === 'datetime' || argType === 'idatetime') {
              argType = 'Date';
            } else if (argType === 'binary') {
              argType = 'File';
            }
            switch(argName) {
              case 'access_token':
                host.tokenRequired = true;
                break;
              case 'app_key':
                host.appKeyRequired = true;
                break;
              case 'app_secret':
                host.appSecretRequired = true;
                break;
              case 'redirect_uri':
                host.redirectUriRequired = true;
                break;
              case 'format':
                break;
              default:
                argName.split('或').forEach(function(name) {
                 host.args.push({
                    name: name.trim(),
                    isRequired: argIsRequired === 'true' || argIsRequired === '必须',
                    type: argType,
                    description: argDesc + conditialDescription
                  });
                });
                break;
            }
            var requiredArgs = host.args.filter(function(arg) {return arg.isRequired;});
            var optionalArgs = host.args.filter(function(arg) {return !arg.isRequired;});
            host.args = requiredArgs.concat(optionalArgs);
          });
        });
        return host;
      });
    }));
  });
};

var crawl = function(){
  return request('http://open.mingdao.com/ApiDocAjax/GetLeftMenu').then(function(args){
    var spec = {};
    var pathList = JSON.parse(args[1]);
    return Promise.all(pathList.map(function(p){
      spec[p.path] = {description: p.name, children: {}};
      return makeModulePromise(spec[p.path], p.path);
    })).then(function(){
      return spec;
    });
  });
};

if(require.main === module) {
  var log = function(obj, level){
    level = level || 0;
    var spaces = '';
    for(var i = 0; i < level; i++) {
      spaces += '  ';
    }
    if(typeof obj === 'object') {
      console.log('{');
      Object.keys(obj).forEach(function(key){
        process.stdout.write(spaces + '  ' + key + ': ');
        log(obj[key], level + 1);
      });
      console.log(spaces + '}');
    } else {
      if(typeof obj === 'string') obj = '"' + obj + '"';
      console.log(obj);
    }
  };
  crawl().then(function(spec){
    log(spec);
  });
}

module.exports = crawl