
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
  TriggersReplacement: ['BaseApiId'],
  NoUpdate: function(physicalId, params, reply) {
    SeekRootResource(physicalId, reply);
  },
  SchemaPath: [__dirname, 'schema.json']
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

  var params = {
    restApiId: physicalId,
    patchOperations: []
  };

  ['Name', 'Description'].forEach(patch);

  console.log('Sending PATCH to API Gateway RestApi: %j', params);

  APIG.updateRestApi(params, handleReply(reply));

  function patch(key) {
    var keyPath = '/' + key[0].toLowerCase() + key.slice(1, key.length);
    params.patchOperations.push({
      op: 'replace',
      path: keyPath,
      value: freshParams[key]
    });
  }
}

function SeekRootResource(apiId, reply, position) {
  APIG.getResources({
    restApiId: apiId,
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
      return SeekRootResource(apiId, reply, data.position);
    }
    reply(null, apiId, {
      RootResourceId: rootResource.id
    });
  });
}

function handleReply(reply) {
  return function(err, api) {
    if (err) {
      console.error(err.message);
      return reply(err);
    }
    console.log('Got data back from API Gateway: %j', api);
    SeekRootResource(api.id, reply);
  };
}
