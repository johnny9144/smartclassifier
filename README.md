Smart Classifier
===================
Smart Classifier is a program that could guess that what you are talking about or area that article is dicussing.

**P.s Just work on Traditional Chinese (big5).**
Installation
===================
    npm install smartclassifier
Initialization
===================
```javascript
    Object.init(CkIPServerIPAddress, port, account, password);
```
Classify
===================
```javascript
    var data = [
		    { title: 'title', content: 'content you want to classifier'},
		    { title: 'title', content: 'content you want to classifier'}];

    classifier.classifier(data, function (result) {
		  console.log(result);
```
 This is the result
```javascript
    [{ title: 'title', content: 'content' area: '', class:''},
     { title: 'title', content: 'content' area: '', class:''}]
```

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
MIT License  
National Dong Hwa University  
