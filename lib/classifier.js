/* jshint node: true */
var natural = require('natural'),
    iconvlite = require('iconv-lite'),
    net = require('net'),
    async = require('async'),
    fs = require('fs'),
    parseString = require('xml2js').parseString,
    client = new net.Socket();

(function () {
  'use strict';
  var classifier = {},                  // the exports module
      localMemory = {
        username: '',                    // ckip account
        password: '',                    // ckip password
        areaClassifier: null,                   // the brain of area
        classClassifier: null,                  // the brain of class
        stopWord: []                       // the stop word data
      },
      completeClassCount = 0,           // calcuate how many data have completed
      threads = 0,                      // calcuate how many data we have to analysis
      ckipGate = true,                  // ckip gate controller
      classifierGate = true,            // classifier service gate controller
      classingArticle = {},             // the data which handling
      classingResultArray = [],         // the wordArray which saved the word from ckip
      ckipScheduleData = [],            // saved the handling article sentences
      classifierScheduleData = [],      // the data wait for classing
      finallyResult = [],               // the array which saved the return data
      finalNext;                        // waterfall next to result

  /**
   * [loadClassifierBrain load dictionary from dict]
   * @method loadBrain
   * @return {[Object]}  [load brain to global for using]
   */
  function loadClassBrain() {
    // Loading the json with natural module
    natural.BayesClassifier.load(__dirname + '/../dict/classifier.json', null, function(err, classifier) {
      if (err) {
        throw ('loaded Classifier.json failed' + err);
      }
      localMemory.classClassifier = classifier;
    });
  }
  /**
   * [loadAreaBrain load dictionary from dict]
   * @method loadBrain
   * @return {[Object]}  [load brain to global for using]
   */
  function loadAreaBrain() {
    // Loading the json with natural module
    natural.BayesClassifier.load(__dirname + '/../dict/classifierArea.json', null, function(err, classifier) {
      if (err) {
        throw ('loaded classifierArea.json failed' + err);
      }
      localMemory.areaClassifier = classifier;
    });
  }
  /**
   * [getStopWord description]
   * @method getStopWord
   * @return {type}    [loading a stop word dictionary from json]
   */
  function getStopWord () {
    fs.readFile( __dirname + '/../dict/stopWord.txt', function (err, fields) {
      if (err) {
        throw err;
      }
      try {
        var stopWord = fields.toString().split('\n');
        localMemory.stopWord = stopWord;
      } catch (e) {
        throw 'getStopWord err: ' + e;
      }
    });
  }
  /**
   * [connectCKIP description]
   * Connect to ckip server, you have to connect to ckip adminatrator and key in the password and account
   * @method conne ctCKIP
   * @param  {[String]}    address [CKIP address]
   * @param  {[type]}    port    [Port use on ckipServer]
   * @return {[type]}            [none return value, bridge a connection with ckip server]
   */
  function connectCKIP (address, port) {
    client.connect(port, address, function(conn) {
      console.log('connect!');
    });
    // set no delay when pushing the message, the message would be flush immediately
    client.setNoDelay(true);
  }
  /**
   * [listenData description]
   * Start up a listening that ready to receive messages from ckip server
   * Because the ckip server deal with big5, we have to convert encode from big5 to utf8 for javascript to use correctly
   * and when we used iconvlite, it have the chance to convert fail. Use exception to wrap up
   * @method listenData
   * @return {[type]}   [description]
   */
  function listenData () {
    client.on('data', function(data) {
      try {
        data = iconvlite.decode(data, 'big5');
      } catch (e) {
        throw e;
      }
      // set the global controller, let request is sent to ckip server one at once
      ckipGate = true;
      // when the ckip Gate is true, you could send the next messages to ckip server in schedule
      send();
      // at the same time, you have to handle the messages you just receive
      receiveData(data);
    });
  }
  /**
   * [startClassifier description]
   * functions controll the gate of classifier service, the data would be shift from scheduleData
   * @method startClassifier
   * @return {[type]}        [none return value]
   */
  function startClassifier () {
    if (classifierGate && classifierScheduleData.length > 0) {
      var sendData = classifierScheduleData.shift();
      classifierGate = false;
      classingResultArray = [];
      classingArticle = sendData;
      if (sendData.content !== undefined) {
        return splitData(sendData.content);
      } else {
        console.log('startClassifier err: content is undefined');
      }
    }
  }
  /**
   * [send description]
   * send data to ckip if the previous one is end and set ckipGate close
   * @method send
   * @return {[type]} [description]
   */
  function send () {
    if (ckipGate && ckipScheduleData.length > 0) {
      ckipGate = false;
      var sendData = ckipScheduleData.shift();
      sendXml2CKIP(sendData);
    }
  }
  /**
   * [splitData description]
   * splitData to sentence and push them into tempData
   * @method splitData
   * @param  {[type]}  data [description]
   * @return {[type]}       [description]
   */
  function splitData (data) {
    // replace the sign which could be paragraph
    data = data.replace(/．|。|\?|(\n)+|？|\./gi,"\n");
    try {
      // split data by \n into an array
      data = data.split("\n");
      // let the forLoop run faster
      var dataLeng = data.length;
      // put sentences into ckipScheduleData and wait for ckipServer
      for (var i = 0; i < dataLeng; i+=1) {
        var sendData =  data[i].trim();
        if (sendData !== '') {
          ckipScheduleData.push(sendData);
          // call ckip gate controller
          send();
        }
      }
    } catch (e) {
      console.log('Err when spliting ' + e);
      // open the gate of classifier and call the next data
      classifierGate = true;
      classingArticle.area = 'error';
      classingArticle.class = 'error';
      finallyResult.push(classingArticle);
      return startClassifier();
    }
  }
  /**
   * [sendXml2CKIP description]
   * organize the xml content, prepare for sending
   * convert data to xml and encode in big5, becase ckip server just deal with big
   * finally, send xml to ckip server
   * @method sendXml2CKIP
   * @param  {[type]}     inputData [description]
   * @return {[type]}               [description]
   */
  function sendXml2CKIP (inputData) {
    var xml = '<?xml version="1.0" ?><wordsegmentation version="0.1"><option showcategory="1"/><authentication username="' + localMemory.username + '" password="' + localMemory.password + '"/><text>'+ inputData +'</text></wordsegmentation>';
    try {
      xml = iconvlite.encode(xml, 'big5');
      client.write(xml);
    } catch (e) {
      console.log('sendXml2CKIP err: ' + e + '//' + xml);
      // if error, we send the next data from ckipScheduleData
      ckipGate = true;
      send();
    }
  }
  /**
   * [classifierTheResult description]
   * analysis the result with resultData Array which include Word Segmenter result
   * @method classifierTheResult
   * @return {[type]}            [description]
   */
  function classifierTheResult () {
    if (ckipGate && ckipScheduleData.length === 0) {
      var classifierResult = '',
          classifierAreaResult = '';
      if (classingResultArray.length > 0 ) {
        var result = localMemory.classClassifier.getClassifications(classingResultArray),
            resultArea = localMemory.areaClassifier.getClassifications(classingResultArray),
            compareNum = (result[1].value/result[0].value)*100,
            compareAreaNum = (resultArea[1].value/resultArea[0].value)*100;
            console.log(result)
        if ((100 - compareNum) > 50) {
          classifierResult = result[0].label;
        } else {
          classifierResult = 'unknow';
        }
        if ((100 - compareAreaNum) > 25) {
          classifierAreaResult = resultArea[0].label;
        } else {
          classifierAreaResult = 'unknow';
        }
      } else {
        classifierAreaResult = 'unknow';
        classifierResult = 'unknow';
      }
      completeClassCount+=1;
      classingArticle.area = classifierAreaResult;
      classingArticle.class = classifierResult;
      finallyResult.push(classingArticle);
      processControll();
      classifierGate = true;
      startClassifier();
    }
  }
  /**
   * [processControll description]
   *
   * @method processControll
   * @param  {[type]}        classifierResult     [description]
   * @param  {[type]}        classifierAreaResult [description]
   * @return {[type]}                             [description]
   */
  function processControll () {
    if (threads === completeClassCount) {
      classifierGate = true;
      threads = 0;
      completeClassCount = 0;
      finalNext(null, finallyResult);
    }
  }
  /**
   * [receiveData description]
   * handle the data just listen from ckip, push it into resultArray
   * @method receiveData
   * @param  {[type]}    input [description]
   * @return {[type]}          [description]
   */
  function receiveData (input) {
    parseString(input, { explicitArray: false, trim: true}, function (err, result) {
      var str = [];
          try {
            str = result.wordsegmentation.result.sentence.split(/\s/);
            var strLeg = str.length;
            for (var i = 0; i < strLeg; i+=1) {
              // delete the word that include mark or english ...etc
              var word = str[i].replace(/[^\u4E00-\u9FA5]/gi, "");
              // check that the word is not in the stop word dictionary
              // and check the word is exist
              if (localMemory.stopWord.indexOf(word) < 0 && word.length > 1) {
                classingResultArray.push(word);
              }
            }
          } catch (e) {
            console.log('reveiveData Err' + e);
          }
          classifierTheResult();
    });
  }
  /**
   * [init description]
   * init the module, Establish the connection to ckip server and ready to analysis the data
   * @method init
   * @param  {[String]} address [ckip server address]
   * @param  {[Integer]} port    [port service on ckip server]
   * @return {[type]}         [none return value]
   */
  classifier.init = function (address, port, username, password) {
    getStopWord();
    loadAreaBrain();
    loadClassBrain();
    localMemory.username = username;
    localMemory.password = password;
    connectCKIP(address, port);
    listenData();
  };

  classifier.classifier = function (data, callback) {
    threads = data.length;
    if (threads > 0) {
      async.waterfall([
        function (next) {
          for (var i = 0;i < threads; i+=1) {
            classifierScheduleData.push(data[i]);
          }
          next();
        },
        function (next) {
          startClassifier();
          finalNext = next;
        }
      ], function (err, result) {
          if (err) {
            console.log(err);
          }
          return callback(result);
      });
    } else {
      return callback('type error or null data!');
    }
  };

  // Node.js
  if (typeof module === 'object' && module.exports) {
      module.exports = classifier;
  }
  // AMD / RequireJS
  else if (typeof define === 'function' && define.amd) {
      define([], function () {
          return classifier;
      });
  }
  // included directly via <script> tag
  else {
      root.async = classifier;
  }
}());
