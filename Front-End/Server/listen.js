module.exports = {
  start: (app, PORT)=>{
    app.listen(PORT,()=>{
      var d = new Date();
      var n = d.getHours();
      var m = d.getMinutes();
      console.log('Server has been started at : ' + n + ':' +m);
    });
    }
  }