
var AWS = require('aws-sdk');

var CfnLambda = require('cfn-lambda');

var APIG = new AWS.APIGateway({apiVersion: '2015-07-09'});

var Create = CfnLambda.SDKAlias({
  returnPhysicalId: 'id',
  downcase: true,
  api: APIG,
  method: 'createRestApi',
  mapKeys: {
    BaseApiId: 'cloneFrom'
  }
});

var Delete = CfnLambda.SDKAlias({
  returnPhysicalId: 'id',
  downcase: true,
  ignoreErrorCodes: [404],
  physicalIdAs: 'restApiId',
  keys: ['restApiId'],
  api: APIG,
  method: 'deleteRestApi'
});

exports.handler = CfnLambda({
  Create: Create,
  Update: Update,
  Delete: Delete,
  SchemaPath: [__dirname, 'schema.json'],
  NoUpdate: NoUpdate
});

function Update(physicalId, freshParams, oldParams, reply) {
  // Full replace
  if (freshParams.BaseApiId !== oldParams.BaseApiId) {
    return Delete(physicalId, null, function(deletionError) {
      if (deletionError) {
        return reply(deletionError);
      }
      Create(freshParams, reply);
    });
  }
  var params = {
    restApiId: physicalId,
    patchOperations: []
  };

  ['Name', 'Description'].forEach(patch);

  console.log('Sending PATCH to API Gateway RestApi: %j', params);

  APIG.updateRestApi(params, function(err, api) {
    if (err) {
      console.error(err.message);
      return reply(err);
    }
    reply(null, api.id);
  });

  function patch(key) {
    var keyPath = '/' + key.toLowerCase();
    if (freshParams[key] === oldParams[key]) {
      return;
    }
    if (!oldParams[key]) {
      return params.patchOperations.push({
        op: 'add',
        path: keyPath,
        value: freshParams[key]
      });
    }
    if (!freshParams[key]) {
      return params.patchOperations.push({
        op: 'remove',
        path: keyPath
      });
    }
    params.patchOperations.push({
      op: 'replace',
      path: keyPath,
      value: freshParams[key]
    });
  }
}

function NoUpdate(old, fresh) {
  return [
    'Name',
    'Description',
    'BaseApiId'
  ].every(function(key) {
    return old[key] === fresh[key];
  });
}
