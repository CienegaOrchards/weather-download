const promisify = require('util').promisify;
const _ = require('lodash');
const throat = require('throat');
const ProgressBar = require('progress');

const moment = require('moment');
require('twix');

const parse = promisify(require('csv-parse'));
const stringify = promisify(require('csv-stringify'));

const request = require('request-promise-native');

// https://www.wunderground.com/weatherstation/WXDailyHistory.asp?ID=KCAHOLLI28&graphspan=day&month=2&day=16&year=2016&format=1

// const range = moment('2016-02-16').twix('2016-02-17', { allDay: true }).toArray('days');
const range = moment('2016-02-16').twix(moment(), { allDay: true }).toArray('days');

const bar = new ProgressBar(' downloading [:bar] :rate/rps :percent :etas', { total: range.length,  width: 100 });

const fetch_date = function (date) {
    return request({
        uri: 'https://www.wunderground.com/weatherstation/WXDailyHistory.asp',
        qs: {
            ID:         'KCAHOLLI28',
            graphspan:  'day',
            day:        date.date(),
            month:      date.month()+1, // Moment month is zero-based
            year:       date.year(),
            format:     1,
        },
    })
    .then((body) => {
        bar.tick();
        if (bar.complete) {
            console.error('\ncomplete\n');
        }

        return body.replace(/,\n<br>\n/gi, '\n').replace('<br>','');
    })
    .catch((err) => {
        console.error(err.stack);
    });
}

// console.log(range.map(date => ({day:date.date(), month:date.month(), year:date.year()})));
Promise.all(range.map(throat(25, date => fetch_date(date))))
.then(csv_results => {
    return Promise.all(csv_results.map(csv_data => parse(csv_data, { auto_parse: true, columns: true, skip_empty_lines: true })));
})
.then(res => {
    return _.chain(res)
    .flatten()
    .map(x => _.omit(x, ['Time','SoftwareType']))
    .sortBy('DateUTC')
    .value();
})
.then(res => {
    return stringify(res, { header: true, quotedString: true });
})
.then(res => {
    console.log(res);
})
