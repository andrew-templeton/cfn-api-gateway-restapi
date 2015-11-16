
var AWS = require('aws-sdk');

var CfnLambda = require('cfn-lambda');

var APIG = new AWS.APIGateway({apiVersion: '2015-07-09'});



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

function Create(params, reply) {
  var params = {
    name: params.Name,
    cloneFrom: params.BaseApiId,
    description: params.Description
  };
  console.log('Sending POST to API Gateway RestApi: %j', params);
  APIG.createRestApi(params, handleReply(reply));
}

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

  APIG.updateRestApi(params, handleReply(reply));

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

function handleReply(reply) {
  return function(err, api) {
    if (err) {
      console.error(err.message);
      return reply(err);
    }
    seekRootResource();
    function seekRootResource(position) {
      APIG.getResources({
        restApiId: api.id,
        limit: 500,
        position: position
      }, function(err, data) {
        if (err) {
          console.error('Error while seeking root resource: %j', err);
          return reply(err);
        }
        if (!(data && data.items && data.items.length)) {
          var notFound = 'Could not find the root resource of the API!';
          console.error(notFound);
          return reply(notFound);
        }
        var rootResource = data.items.filter(function(resource) {
          return resource.path === '/';
        })[0];
        if (!rootResource) {
          return seekRootResource(data.position);
        }
        reply(null, api.id, {
          RootResourceId: rootResource.id
        });
      });
    }
  };
}
