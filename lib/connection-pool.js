'use strict';

var domain = require('domain');
var Q = require('q');
var Connection = require('./connection');

var ConnectionPool = function(){
	this.connections = {};

	this.autoId = 1;
};

var proto = ConnectionPool.prototype;

// Execute func in a new connection
proto.execute = function(func){
	var self = this;
	var d = domain.create();
	d._id = this.autoId++;

	var connection = new Connection({_id : d._id});
	this.connections[connection._id] = connection;

	// Callback mode
	if(func.length === 1){
		d.run(func(function(){
			connection.close();
			delete self.connections[connection._id];
		}));
		return;
	}

	// Promise mode
	var deferred = Q.defer();
	d.run(function(){
		Q.fcall(function(){
			return func();
		}).then(function(ret){
			deferred.resolve(ret);
		}, function(err){
			deferred.reject(err);
		}).done(function(){
			try{
				connection.close();
				delete self.connections[connection._id];
			}
			catch(e){
				//Should not reach here
			}
		});
	});
	return deferred.promise;
};

// Get connection from current scope
proto.getCurrentConnection = function(){
	var connectionId = process.domain._id;
	if(!connectionId){
		return;
	}
	var connection = this.connections[connectionId];
	if(!connection){
		return;
	}
	return connection;
};

proto.commit = function(){
	var connection = this.getCurrentConnection();
	if(!connection){
		throw new Error('Connection is null');
	}
	connection.commit();
};

proto.rollback = function(){
	var connection = this.getCurrentConnection();
	if(!connection){
		throw new Error('Connection is null');
	}
	connection.rollback();
};

proto.lock = function(objs, cb){
	var connection = this.getCurrentConnection();
	if(!connection){
		throw new Error('Connection is null');
	}
	return connection.lock(objs, cb);
};

module.exports = ConnectionPool;
