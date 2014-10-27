'use strict';

var mongoose = require('mongoose-bird')(),
    Schema = mongoose.Schema;

var CurrenttaskSchema = new Schema({
  name: String,
  totalSeconds:Number,
  date: Date,
  started: Boolean,
  userId: Schema.Types.ObjectId,
  workStream: Schema.Types.ObjectId
});

module.exports = mongoose.model('Currenttask', CurrenttaskSchema);
