const URI_BASE = 'http://data.lblod.info/form-data/nodes/';


module.exports = {
  name: 'urban-renewal-concept-subsidy/oproep-2025/missing-types-extractor',
  execute: async (store, graphs, lib, source) => {
    const {$rdf, mu, sudo} = lib;

    const RDF_TYPE = new $rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    const SUBSIDIE = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/');
    const EXT = new $rdf.Namespace('http://mu.semte.ch/vocabularies/ext/');

    const SCHEMA = new $rdf.Namespace('http://schema.org/');
    const ATTACHMENT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/attachment');
    const BESTANDEN_LISTING_UNIT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/bestandenListingUnit');
    
    const contactPoint = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const politicalReferenceContactPoint = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const attachment = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const bestandenListingUnit = new $rdf.NamedNode(URI_BASE + mu.uuid());

    store.add($rdf.sym(source.uri), SCHEMA('contactPoint'), $rdf.sym(contactPoint), graphs.additions);
    store.add($rdf.sym(contactPoint), RDF_TYPE, SCHEMA('ContactPoint'), graphs.additions);

    store.add($rdf.sym(source.uri), EXT('politicalReferenceContactPoint'), $rdf.sym(politicalReferenceContactPoint), graphs.additions);
    store.add($rdf.sym(politicalReferenceContactPoint), RDF_TYPE, EXT('PoliticalReferenceContactPoint'), graphs.additions);

    store.add($rdf.sym(source.uri), SUBSIDIE('attachment'), $rdf.sym(attachment), graphs.additions);
    store.add($rdf.sym(attachment), RDF_TYPE, ATTACHMENT('FormData'), graphs.additions);

    store.add($rdf.sym(source.uri), SUBSIDIE('bestandenListingUnit'), $rdf.sym(bestandenListingUnit), graphs.additions);
    store.add($rdf.sym(bestandenListingUnit), RDF_TYPE, BESTANDEN_LISTING_UNIT('FormData'), graphs.additions);
  }
}