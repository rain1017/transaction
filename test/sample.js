'use strict';

var T = require('../lib');
var Q = require('q');

var main = function(){

	var obj = {simple : 1, compound : {key : 1}};

	// Make object transactionable
	T.transactionable(obj);

	// You can also specify which keys to include or exclude
	// Object attributes which cannot be deepcopyed (like reference to outer resources or circular reference) must be excluded
	// T.transactionable(obj, {includeKeys : 'key1 key2'})
	// T.transactionable(obj, {excludeKeys : 'key1 key2'})

	// Execute code in a new 'connection' (the 'connection/lock/commit/rollback' terminologies are similar to traditional database)
	T.execute(function(){
		return Q.fcall(function(){
			return T.lock(obj); // lock obj for write
		})
		.then(function(){
			obj.simple = 2; // Set 'simple' value

			// obj.compound.key = 2; // Oops! Don't do this!
			var compound = obj.compound; // Retrieve 'compound' value
			compound.key = 2;
			obj.compound = compound; // Set 'compound' value

			T.commit(); // All lock released after commit or rollback

			// obj.simple = 3; // Oops! Should lock first
		})
		.then(function(){
			return T.lock(obj);
		})
		.then(function(){
			obj.simple = 3;
			throw new Error('Exception here!');
		})
		.then(function(){
			T.commit(); // Will not execute
		}, function(err){
			T.rollback(); // Should rolled back
		})
		.then(function(){
			console.log(obj.simple); // output: 2
		});
	});

};

if (require.main === module) {
    main();
}
