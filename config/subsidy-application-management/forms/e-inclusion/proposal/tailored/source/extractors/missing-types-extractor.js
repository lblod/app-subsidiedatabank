const URI_BASE = 'http://data.lblod.info/form-data/nodes/';

module.exports = {
  name: 'climate/bicycle-infrastructure/request/missing-types-extractor',
  execute: async (store, graphs, lib, source) => {
    const {$rdf, mu, sudo} = lib;

    const RDF_TYPE = new $rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    const SCHEMA = new $rdf.Namespace('http://schema.org/');

    const bankAccount = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const contactPoint = new $rdf.NamedNode(URI_BASE + mu.uuid());
    
    store.add($rdf.sym(source.uri), SCHEMA('contactPoint'), $rdf.sym(contactPoint), graphs.additions);
    store.add($rdf.sym(contactPoint), RDF_TYPE, SCHEMA('ContactPoint'), graphs.additions);

    store.add($rdf.sym(source.uri), SCHEMA('bankAccount'), $rdf.sym(bankAccount), graphs.additions);
    store.add($rdf.sym(bankAccount), RDF_TYPE, SCHEMA('BankAccount'), graphs.additions);
    
  }
}