
declare namespace PouchDB {
  export interface Database<Content extends {} = {}> {
      rel: any;
      setSchema(schema: any);
  }
}
