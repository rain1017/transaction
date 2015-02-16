'use strict';

var Q = require('q');
var util = require('util');

var Connection = function(opts){
	opts = opts || {};
	this._id = opts._id;
	this.finished = false;
	this.objtrans = [];

	this.closed = false;
};

Connection.prototype.lock = function(objs, cb){
	if(this.closed){
		throw new Error('Connection is closed');
	}

	if(!Array.isArray(objs)){
		objs = [objs];
	}

	var objtrans = objs.map(function(obj){
		var objtran = obj.__tran__;
		if(!objtran){
			throw new Error('Object ' + util.inspect(obj) + ' is not transactionable');
		}
		return objtran;
	});

	var self = this;

	var promise = Q.all(objtrans.map(function(objtran){
		return Q.fcall(function(){
			return objtran.lock(self._id);
		}).then(function(){
			self.objtrans.push(objtran);
		});
	}));

	// callback pattern
	if(typeof(cb) === 'function'){
		promise.then(function(){
			cb();
		}, function(err){
			cb(err);
		});
	}
	else{
	// promise pattern
		return promise;
	}
};

Connection.prototype.commit = function(){
	if(this.closed){
		throw new Error('Connection is closed');
	}

	var self = this;
	this.objtrans.forEach(function(objtran){
		objtran.commit(self._id);
		objtran.unlock(self._id);
	});
	this.objtrans = [];
};

Connection.prototype.rollback = function(){
	if(this.closed){
		throw new Error('Connection is closed');
	}

	var self = this;
	this.objtrans.forEach(function(objtran){
		objtran.rollback(self._id);
		objtran.unlock(self._id);
	});
	this.objtrans = [];
};

Connection.prototype.close = function(){
	if(this.closed){
		throw new Error('Connection is closed');
	}
	this.rollback();
	this.closed = true;
};

module.exports = Connection;
