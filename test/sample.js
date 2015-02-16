'use strict';

var T = require('../lib');
var Q = require('q');

var main = function(){

	var obj = {simple : 1, compound : {key : 1}};

	// Make object transactionable
	T.transactionable(obj);

	// You can also specify which keys to include or exclude
	// Object attributes which cannot be deepcopyed must be excluded
	// (like reference to outer resources or circular reference)
	// T.transactionable(obj, {includeKeys : 'key1 key2'});
	// T.transactionable(obj, {excludeKeys : 'key1 key2'});

	// Execute code in a new 'connection' (the 'connection/lock/commit/rollback' terminologies are similar to traditional database)
	T.execute(function(){
		return Q.fcall(function(){
			// lock obj for write
			// lock from other execute content will block
			// and read from other execute content will always see old value until commit
			// You can also lock multiple objects by T.lock([obj1, obj2]);
			return T.lock(obj);
		})
		.then(function(){
			obj.simple = 2; // Set 'simple' value

			// obj.compound.key = 2; // Oops! Don't do this!
			var compound = obj.compound; // Retrieve 'compound' value
			compound.key = 2;
			obj.compound = compound; // Set 'compound' value

			T.commit(); // All locks will be released after commit or rollback

			console.log(obj.simple); // Read only access
			// obj.simple = 3; // Oops! should lock first
		})
		.then(function(){
			return T.lock(obj);
		})
		.then(function(){
			obj.simple = 3;
			throw new Error('Exception here!');
		})
		.then(function(){
			T.commit(); // This will not execute
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
