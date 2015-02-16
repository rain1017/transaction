# transaction

Transaction support for in memory plain objects (Beta version)

[![Build Status](https://travis-ci.org/rain1017/transaction.svg?branch=master)](https://travis-ci.org/rain1017/transaction)
[![Dependencies Status](https://david-dm.org/rain1017/transaction.svg)](https://david-dm.org/rain1017/transaction)

## Get Started

Transaction support for in memory plain objects
Lock/Commit/Rollback in memory objects just like access data in traditional database

For robustness and performance both

```
var T = require('transaction');
var Q = require('q');


var obj = {simple : 1, compound : {key : 1}};

// Make object transactionable
T.transactionable(obj);

// You can also specify which keys to include or exclude
// Object attributes which cannot be deepcopyed (like reference to outer resources or circular reference) must be excluded
// T.transactionable(obj, {includeKeys : 'key1 key2'})
// T.transactionable(obj, {excludeKeys : 'key1 key2'})

// Execute code in a new 'database connection'
// The 'connection/lock/commit/rollback' terminologies are similar to traditional database
T.execute(function(){
	return Q.fcall(function(){
		return T.lock(obj); // lock obj for write, lock from other execute content will block
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
```

## License
(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
