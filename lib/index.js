'use strict';

var _ = require('lodash');
var Q = require('q');
var util = require('util');
var deepcopy = require('deepcopy');
var Lock = require('async-lock');
var ConnectionPool = require('./connection-pool');

var poolInstance = new ConnectionPool();

var DEFAULT_LOCK_TIMEOUT = 10 * 1000;

/**
 * obj.transactionable({excludekeys : 'key1 key2'});
 */
var transactionable = function(obj, opts){
	opts = opts || {};
	var objtran = {};
	objtran.lockObj = new Lock();
	objtran.releaseCallback = null;
	objtran.connectionId = null; // Connection who hold the lock
	objtran.changed = {};
	objtran.commited = {};
	objtran.includeKeys = opts.includeKeys ? opts.includeKeys.split(' ') : null;
	objtran.excludeKeys = _.union(['__tran__'], opts.excludeKeys ? opts.excludeKeys.split(' ') : []);

	var throwAccessError = function(connectionId){
		throw new Error('Object ' + util.inspect(obj) + ' is not locked by connection ' + connectionId);
	};

	objtran.get = function(connectionId, key){
		var value = undefined; // jshint ignore:line
		if(objtran.connectionId === connectionId){
			value = objtran.changed.hasOwnProperty(key) ? objtran.changed[key] : objtran.commited[key];
		}
		else{
			value = objtran.commited[key];
		}
		return deepcopy(value);
	};

	objtran.set = function(connectionId, key, value){
		if(objtran.connectionId === connectionId){
			objtran.changed[key] = deepcopy(value);
		}
		else{
			throwAccessError(connectionId);
		}
		if(poolInstance.autoCommit){
			poolInstance.commit(connectionId);
		}
	};

	objtran.lock = function(connectionId){
		var deferred = Q.defer();
		if(connectionId === objtran.connectionId){
			deferred.resolve();
		}
		else{
			var savedDomain = process.domain;
			objtran.lockObj.acquire('', function(release){
				process.domain = savedDomain;

				objtran.connectionId = connectionId;
				objtran.releaseCallback = release;
				objtran.changed = {};
				objtran.lockTimeout = setTimeout(objtran.unlock.bind(null, connectionId), DEFAULT_LOCK_TIMEOUT);
				deferred.resolve();
			});
		}
		return deferred.promise;
	};

	objtran.unlock = function(connectionId){
		if(objtran.connectionId !== connectionId){
			throwAccessError(connectionId);
		}
		clearTimeout(objtran.lockTimeout);
		objtran.changed = {};
		objtran.connectionId = null;
		var releaseCallback = objtran.releaseCallback;
		objtran.releaseCallback = null;

		process.nextTick(releaseCallback);
	};

	objtran.commit = function(connectionId){
		if(objtran.connectionId !== connectionId){
			throwAccessError(connectionId);
		}
		Object.keys(objtran.changed).forEach(function(key){
			objtran.commited[key] = objtran.changed[key];
		});
		objtran.changed = {};
	};

	objtran.rollback = function(connectionId){
		if(objtran.connectionId !== connectionId){
			throwAccessError(connectionId);
		}
		objtran.changed = {};
	};


	var keys = objtran.includeKeys ? objtran.includeKeys : _.difference(Object.keys(obj), objtran.excludeKeys);
	keys.forEach(function(key){
		objtran.commited[key] = obj[key];

		Object.defineProperty(obj, key, {
			get : function(){
				var connection = poolInstance.getCurrentConnection();
				var connectionId = !!connection ? connection._id : null;
				return objtran.get(connectionId, key);
			},

			set : function(value){
				var connection = poolInstance.getCurrentConnection();
				if(!connection){
					throw new Error('You are not in any execute scope');
				}
				objtran.set(connection._id, key, value);
			},
		});
	});

	obj.__tran__ = objtran;
};

poolInstance.transactionable = transactionable;
poolInstance.autoCommit = false;

module.exports = poolInstance;

