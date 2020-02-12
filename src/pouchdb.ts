/* istanbul ignore file */

import {RelDB} from './index';

declare global {
  namespace PouchDB {
    interface Database<Content extends {} = {}> {
      setSchema<T extends {} = Content>(schema: any): RelDatabase<T>;
    }
    
    interface RelDatabase <Content extends {} = {}> extends Database<Content> {
      rel: RelDB;
    }
  }
}

export {}
