'use strict';

var _ = require('lodash');
var Q = require('q');
var should = require('should');
var tran = require('../lib');
var util = require('util');
var Connection = require('../lib/connection');
Q.longStackSupport = true;

describe('tranobj test', function(){
	it('simple get/set/lock/unlock', function(cb){
		var obj = {simple : 1, compound : {key : 1}};
		tran.transactionable(obj);
		var objtran = obj.__tran__;

		Q.fcall(function(){
			return objtran.lock(1);
		}).then(function(){
			var compound = objtran.get(1, 'compound');
			compound.key = 2;

			objtran.set(1, 'compound', compound);
			objtran.get(1, 'compound').key.should.equal(2);

			objtran.set(1, 'simple', 2);
			objtran.get(1, 'simple').should.equal(2);
			objtran.get(2, 'simple').should.equal(1);

			objtran.commit(1);

			objtran.get(2, 'simple').should.equal(2);

			objtran.set(1, 'simple', 3);
			objtran.rollback(1);
			objtran.get(1, 'simple').should.equal(2);

			objtran.unlock(1);
		}).done(function(){
			cb();
		});
	});

	it('lock objects by multiple connections', function(cb){
		var obj1 = {key : 0}, obj2 = {key : 0};
		tran.transactionable(obj1);
		tran.transactionable(obj2);
		var concurrency = 8;

		var connections = _.range(concurrency).map(function(connectionId){
			return new Connection({_id : connectionId});
		});
		Q.all(connections.map(function(connection){
			return Q() // jshint ignore:line
			.delay(_.random(20))
			.then(function(){
				console.log('%s start lock obj1', connection._id);
				return connection.lock(obj1);
			})
			.then(function(){
				console.log('%s got lock obj1', connection._id);
			})
			.delay(_.random(10))
			.then(function(){
				console.log('%s start lock obj2', connection._id);
				return connection.lock(obj2);
			})
			.then(function(){
				console.log('%s got lock obj2', connection._id);
			})
			.delay(_.random(10))
			.then(function(){
				var obj1value = obj1.__tran__.get(connection._id, 'key');
				obj1value++;
				obj1.__tran__.set(connection._id, 'key', obj1value);
				obj2.__tran__.set(connection._id, 'key', obj1value);

				connection.commit();
				console.log('%s commited', connection._id);
			});
		})).then(function(){
			var obj1value = obj1.__tran__.get(null, 'key');
			obj1value.should.equal(connections.length);

			var obj2value = obj2.__tran__.get(null, 'key');
			obj2value.should.equal(obj1value);
		}).done(function(){
			cb();
		});
	});

	it('execute test', function(cb){
		var obj = {simple : 0, compound : {key : 0}, exclude : 0};
		tran.transactionable(obj, {excludeKeys : 'exclude'});
		var concurrency = 8;

		var self = this;
		Q.all(_.range(concurrency).map(function(){
			return tran.execute(function(){
				var domainId = process.domain._id;

				return Q() // jshint ignore:line
				.delay(_.random(20))
				.then(function(){
					console.log('%s start lock obj', domainId);
					return tran.lock(obj);
				})
				.then(function(){
					console.log('%s got lock obj', domainId);
					obj.simple = obj.simple + 1;
					var compound = obj.compound;
					compound.key++;
					obj.compound = compound;
				})
				.delay(_.random(10))
				.then(function(){
					tran.commit();
					console.log('%s commited', domainId);
				})
				.delay(_.random(10))
				.then(function(){
					return tran.lock(obj);
				})
				.then(function(){
					obj.simple = 'invalid';
					obj.exclude = 1;
					throw new Error('exception here!');
				})
				.then(function(){
					tran.commit();
				}, function(e){
					tran.rollback(); // Should rolled back
				});
			});
		})).then(function(){
			obj.simple.should.equal(concurrency);
			obj.compound.key.should.equal(concurrency);
			obj.exclude.should.equal(1); // Excluded keys not rolled back
		}).done(function(){
			cb();
		});
	});
});
