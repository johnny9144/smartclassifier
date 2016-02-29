Smart Classifier
===================
Smart Classifier is a program that could guess that what you are talking about or area that article is dicussing.

**P.s Just work on Traditional Chinese (big5).**

----------
Installation
===================

    npm install smartclassifier

Initialization
===================
    Object.init(CkIPServerIPAddress, port, account, password);

Classify
===================

    var data = [
		    { title: 'title', content: 'content'},
		    { title: 'title', content: 'content'}];

    classifier.classifier(data, function (result) {
		  console.log(result);
 This is the result


    [{ title: 'title', content: 'content' area: '', class:''},
     { title: 'title', content: 'content' area: '', class:''}]

Library
===================
Currently, we just have the below libraies, so the smartClassifier just could identify these theme.
 - Earthquake
 - Typhoon
 - Cold
 - Polity

License
===================
The smartclassifier is authorized to Academic use.

Copyright(c) 2016-2020 Bo-Wei Huang

MIT Licensed

If you have any question, please contact me with mail.

johnny914425@gmail.com

I'll response you as soon as posible.
