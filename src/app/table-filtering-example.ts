import { HttpClient } from "@angular/common/http";
import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import moment from "moment";
import _ from "lodash";
import { sum, round, median, mean } from "mathjs";
import { mergeNsAndName } from "@angular/compiler";

export interface Stock {
  symbol?: string;
  currency?: string;
  exchange?: string;
  country?: string;
  sector?: string;
  industry?: string;
  dailyInfoList?: IntervalInfo[]
  quarterIncome?: IncomeInfo[]
}

export interface IntervalInfo {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  dividend?: string;
}

export interface IncomeInfo {
  fiscalDateEnd?: string;
  earningDate?: string;
  revenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  netIncome?: number;
  shares?: number;
}

export interface EarningsPrice extends IncomeInfo {
  intervalInfo?: IntervalInfo;
  grossProfitCalc?: Calculation;
}

export interface Calculation {
  value?: number;
  ratio?: number;
  growth?: number;
  averageRatio?: number;
  averageGrowth?: number;
}

export enum FunctionCall {
  TIME_SERIES_DAILY_ADJUSTED = 'TIME_SERIES_DAILY_ADJUSTED',
  OVERVIEW = 'OVERVIEW'
}

/**
 * @title Table with filtering
 */
@Component({
  selector: "table-filtering-example",
  styleUrls: ["table-filtering-example.css"],
  templateUrl: "table-filtering-example.html"
})
export class TableFilteringExample implements OnInit {
  public stock: Stock;
  public textInput: string;
  public infoAction: string;
  public dateFormat: string = 'DD/MM/YY';

  public earningsPrice: EarningsPrice[] = [];

  public numberRegex = /(['(']{0,1}[0-9]+[','][0-9]+)/g;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.onReset();
    this.textInput = 'AMZN';
    let numberTest = [10.32,10.86,11.13];
    console.log(median(numberTest));
    console.log(mean(numberTest));
  }

  public onReset() {
    this.textInput = "";
    this.earningsPrice = [];
  }

  public onClear() {
    this.textInput = "";
  }

    public getURL(functionCall: FunctionCall, symbol: string) {
    if(functionCall === FunctionCall.OVERVIEW){
      return 'https://run.mocky.io/v3/a29e6fb5-d3c1-4cc6-9253-918fba8cf00a';
    }
    return 'https://run.mocky.io/v3/d9e1135a-bb0c-45c7-9e9a-5859842530b3'
    return `https://www.alphavantage.co/query?function=${functionCall}&symbol=${symbol}&apikey=XLL4HCDO8UHC77AF&outputsize=full`;
  }

  public onGetOverview(){
    let stock: Stock;
    this.http.get(this.getURL(FunctionCall.OVERVIEW, this.textInput)).subscribe(data => {
      stock = {
          symbol: data['Symbol'],
          currency: data['Currency'],
          exchange: data['Exchange'],
          country: data['Country'],
          sector: data['Sector'],
          industry: data['Industry'],
          dailyInfoList: [],
          quarterIncome: []

      };
      this.stock = stock;
      this.infoAction = this.stock.symbol + ' Overview Retrieved';
    });
  }

  public onGetDailyInfo(){
    let dailyInfoList: IntervalInfo[] = [];
     this.http.get(this.getURL(FunctionCall.TIME_SERIES_DAILY_ADJUSTED, this.textInput)).subscribe(data => {
       let dailyData = data["Time Series (Daily)"];
       for(let key in dailyData){
        dailyInfoList.push({
          date: moment(key, 'YYYY-MM-DD').format(this.dateFormat),
          open: dailyData[key]['1. open'],
          high: dailyData[key]['2. high'], 
          low: dailyData[key]['3. low'],
          close: dailyData[key]['4. close'],
          volume: dailyData[key]['6. volume'],
          dividend: dailyData[key]['7. dividend amount'],
        });
       }
      this.stock.dailyInfoList = dailyInfoList;
      this.infoAction = this.stock.dailyInfoList.length + ' Daily Info';
      this.textInput = '';
    });
  }

  public onSendFiscalPeriodEnd() {
    let regex = /([0-9]+['\/'][0-9]+['\/'][0-9]+)/g;
    this.stock.quarterIncome = this.splitRegex(regex, this.textInput)
     .map(d => {
        return {fiscalDateEnd: d}
      });
    this.infoAction = this.stock.quarterIncome.length + ' Quarter Info';
    this.textInput = '';
    this.createEarningsPrice();
  }

  public onSendEarningsDate(){
    let regex = /([A-z]{3}[' '][0-9]{2}[','][' '][0-9]{4})/g;
    let earningDates = this.splitRegex(regex, this.textInput)
      .map(d => moment(d, "MMM DD, YYYY"))   
      .sort((d1, d2) => (d1.isBefore(d2) ? -1 : 1));
   if(this.stock.quarterIncome){
    this.stock.quarterIncome.map((d, i) => {
        let earnD = _.chain(earningDates)
          .filter(ed => ed.isAfter(moment(d.fiscalDateEnd, this.dateFormat)))
          .first()
          .value();
        d.earningDate = earnD.format(this.dateFormat);
      });
    this.stock.quarterIncome.push(
      ...earningDates
    .filter(d => d.isAfter(moment()))
    .map(d => {
      return {earningDate: d.format(this.dateFormat)}
    }));

    this.stock.quarterIncome = this.stock.quarterIncome
    .sort((d1, d2) => (moment(d1.earningDate, this.dateFormat).isBefore(moment(d2.earningDate, this.dateFormat)) ? -1 : 1))
    this.infoAction = this.stock.quarterIncome.length + ' Quarter Info';
    this.textInput = '';
    this.createEarningsPrice();
   }
  }

   public onSendNumberInfo(info: string){
    let infoList = this.splitRegex(this.numberRegex, this.textInput);
    let numberList = infoList.map(d => {
      d = d.replace(',', '.');
      return d.includes('(') ? -Number(d.replace('(', '')) : Number(d);
    });
    if(this.stock?.quarterIncome){
      this.stock.quarterIncome
      .filter(q => q.fiscalDateEnd)
      .map((d,i)=>{
        d[info] = numberList[i];
      });
    this.textInput = '';
    this.createEarningsPrice();
    }
  }

  public getDailyInfo(earningDate: moment.Moment){
    if(this.stock.dailyInfoList){
        return _.chain(this.stock.dailyInfoList)
        .reverse()
        .filter(d => moment(d.date, this.dateFormat).isBefore(earningDate))
        .first().value();
    }
    return undefined;
  }

  public getDailyInfoTest(){
    console.log(this.getDailyInfo(moment(this.textInput, this.dateFormat)));
  }

  public createEarningsPrice() {
    console.log(this.stock);
    if(this.stock.quarterIncome){
      this.earningsPrice = _.cloneDeep(this.stock.quarterIncome);
      this.earningsPrice.filter(ep => !!ep.fiscalDateEnd).forEach(ep => {
        ep.intervalInfo = this.getDailyInfo(moment(ep.earningDate, this.dateFormat));
      });
/*      this.earningsPrice.filter(ep => !!ep.intervalInfo).forEach((ep, i) => {
        if(i>=3){
          let earningsPricePast = _.takeRight(this.earningsPrice.splice(0,i+1),1000);
          let value = sum(_.takeRight(earningsPricePast.map(ep => ep.grossProfit),4)) / ep.shares;
          let growth = earningsPricePast.length > 1 ? this.gerPercentage(value,earningsPricePast[earningsPricePast.length-2].grossProfitCalc?.value) : 0;
        ep.grossProfitCalc = {
          value: round(value,2),
          ratio: round(ep.intervalInfo?.close / value,2),
          growth: growth
        }
        }
      });

     this.earningsPrice.filter(ep => !!ep.grossProfitCalc).forEach((ep, i) => {
        let grossProfictCalcList = _.takeRight(this.earningsPrice.map(ep => ep.grossProfitCalc).splice(0,i+1),1000);
        ep.grossProfitCalc.averageRatio = mean(grossProfictCalcList.map(gp => gp.value))
        ep.grossProfitCalc.averageGrowth = mean(grossProfictCalcList.map(gp => gp.growth))
      });*/
    }
    console.log(this.earningsPrice);
  }

  public gerPercentage(actualValue: number, previousValue: number){
    return (actualValue - previousValue) / previousValue * 100;
  }

  public splitRegex(regex: RegExp, text: string) {
    let info: string[] = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        info.push(match);
      });
    }
    return info.filter((d, i) => i % 2 === 0);
  }
}

/**  Copyright 2020 Google LLC. All Rights Reserved.
    Use of this source code is governed by an MIT-style license that
    can be found in the LICENSE file at http://angular.io/license */
