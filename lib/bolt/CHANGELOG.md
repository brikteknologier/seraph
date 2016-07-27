Changes from classic seraph API to Bolt API.

* Errors will no longer have a statusCode property.
* When reading a node that does not exist, read will simply return null, instead of throwing an error.
* `removeLabel` can now accept an array.
