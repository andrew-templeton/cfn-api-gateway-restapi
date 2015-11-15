
var AWS = require('aws-sdk');

var CfnLambda = require('cfn-lambda');

var APIG = new AWS.APIGateway({apiVersion: '2015-07-09'});

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



function Delete(physicalId, params, reply) {
  var params = {
    restApiId: physicalId
  };
  console.log('Sending DELETE to API Gateway RestApi: %j', params);
  APIG.deleteRestApi(params, function(err, data) {
    // Already deleted, which is fine
    if (!err || err.statusCode === 404) {
      return reply();
    }
    reply(err.message);
  });
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
    reply(null, api.id, {
      Name: api.name,
      Description: api.description,
      CreatedDate: api.createdDate
    });
  }
}

function currentRegion(context) {
  return context.invokedFunctionArn.match(/^arn:aws:lambda:(\w+-\w+-\d+):/)[1];
}
