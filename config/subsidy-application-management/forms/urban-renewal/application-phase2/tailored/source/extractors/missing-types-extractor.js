const URI_BASE = 'http://data.lblod.info/form-data/nodes/';


module.exports = {
  name: 'urban-renewal/oproep-2025/missing-types-extractor',
  execute: async (store, graphs, lib, source) => {
    const {$rdf, mu, sudo} = lib;

    const RDF_TYPE = new $rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    const SUBSIDIE = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/');
    const EXT = new $rdf.Namespace('http://mu.semte.ch/vocabularies/ext/');

    const POLITICAL_REFERENCE_CONTACTPOINT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/politicalReferenceContactPoint');
    const FINANCING_PARTNER = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/politicalReferenceContactPoint');
    const ATTACHMENT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/attachment');
    const SUBSIDIE_BEDRAG_LISTING_UNIT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/subsidieBedragListingUnit');
    const BESTANDEN_LISTING_UNIT = new $rdf.Namespace('http://lblod.data.gift/vocabularies/subsidie/bestandenListingUnit');
    
    const politicalReferenceContactPoint = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const financingPartner = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const attachment = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const subsidieBedragListingUnit = new $rdf.NamedNode(URI_BASE + mu.uuid());
    const bestandenListingUnit = new $rdf.NamedNode(URI_BASE + mu.uuid());

    store.add($rdf.sym(source.uri), EXT('politicalReferenceContactPoint'), $rdf.sym(politicalReferenceContactPoint), graphs.additions);
    store.add($rdf.sym(politicalReferenceContactPoint), RDF_TYPE, POLITICAL_REFERENCE_CONTACTPOINT('FormData'), graphs.additions);

    store.add($rdf.sym(source.uri), EXT('financingPartner'), $rdf.sym(financingPartner), graphs.additions);
    store.add($rdf.sym(financingPartner), RDF_TYPE, FINANCING_PARTNER('FormData'), graphs.additions);

    store.add($rdf.sym(source.uri), EXT('attachment'), $rdf.sym(attachment), graphs.additions);
    store.add($rdf.sym(attachment), RDF_TYPE, ATTACHMENT('FormData'), graphs.additions);

    store.add($rdf.sym(source.uri), SUBSIDIE('subsidieBedragListingUnit'), $rdf.sym(subsidieBedragListingUnit), graphs.additions);
    store.add($rdf.sym(subsidieBedragListingUnit), RDF_TYPE, SUBSIDIE_BEDRAG_LISTING_UNIT('FormData'), graphs.additions);

    store.add($rdf.sym(source.uri), SUBSIDIE('bestandenListingUnit'), $rdf.sym(bestandenListingUnit), graphs.additions);
    store.add($rdf.sym(bestandenListingUnit), RDF_TYPE, BESTANDEN_LISTING_UNIT('FormData'), graphs.additions);
  }
}