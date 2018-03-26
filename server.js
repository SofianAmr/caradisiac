const express = require('express');
const elasticsearch = require('elasticsearch');
const bodyParser = require('body-parser');
const app = express();
const port = 9292;

const { getBrands } = require('node-car-api');
const { getModels } = require('node-car-api');

const client = new elasticsearch.Client({
  hosts: ['http://localhost:9200'],
  log: 'trace'
});

app.use(bodyParser.urlencoded({ extended: true }));
 
async function getAllModels() {
  const brands = await getBrands();

  for (let brand of brands) {
    let models = await getModels(brand);
    return models;
  }
} //Return All Models of All Brands

async function indexAllModels() {
  let reqBody = [];
  const models = await getAllModels();

  for (let model of models) {
    let index = { "index": { "_index": "cars", "_type": "car", "_id": model.uuid } };
    reqBody.push(index);
    reqBody.push(model);
  }

  client.bulk({
    body: reqBody
  }, function (err, resp) {
    if (err) {
      console.log(err);
    }
    else {
      console.log(resp);
    }
  });

} //Index All Models

//indexAllModels();

app.get('/populate', (req, res) => {
  indexAllModels();
  res.send('index models done');
}); 

const paramForMapping = {
  'index': 'cars',
      'type': 'car',
      'body': {
          'properties': {
              'volume': {
                  'type': 'text',
                  'fielddata': true
              }
          }
      }
}

const paramForSearch = {
  'index': 'cars',
    'body': {
        'query': { 'match_all': {} },
        'sort': [{ 
          'volume' : { 'order' : 'desc' }
        }]
    }
} //Search all models with volume order by desc

app.get('/suv', (req, res) => {
  client.ping({ requestTimeout: 30000 })
        .then(() => client.indices.putMapping(paramForMapping))
        .then(() => client.search(paramForSearch))
        .then((resp) => {
            let json = {};
            // json.page = page;
            // json.limit = limit;
            json.hits = resp.hits.hits.map((hit) => hit._source);
            res.json(json);
        })
        .catch((err) => res.status(500).send(err.message));
});

app.listen(port, () => {
  console.log('We are live on ' + port);
});