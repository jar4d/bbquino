if (Meteor.isClient) {


    function drawChart(){        
        var data = [
            {
                value:20,
                date:1
            },
            {
                value:22,
                date:2
            },
            {
                value:25,
                date:3
            },          
            {
                value:32,
                date:4
            },
            {
                value:42,
                date:5
            },
            {
                value:58,
                date:6
            }           
        ]
          var ctx = $("#pieChart").get(0).getContext("2d");
          var myPieChart = new Chart(ctx);
          new Chart(ctx).Line(data);
}
    myPieChart.update();

template.temperaturePlot.rendered = function(){
  drawChart();

}




    };


if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
