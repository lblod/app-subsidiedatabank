alias Acl.Accessibility.Always, as: AlwaysAccessible
alias Acl.Accessibility.ByQuery, as: AccessByQuery
alias Acl.GraphSpec.Constraint.Resource, as: ResourceConstraint
alias Acl.GraphSpec.Constraint.ResourceFormat, as: ResourceFormatConstraint
alias Acl.GraphSpec, as: GraphSpec
alias Acl.GroupSpec, as: GroupSpec
alias Acl.GroupSpec.GraphCleanup, as: GraphCleanup

defmodule Acl.UserGroups.Config do

  defp access_by_role( group_string ) do
    %AccessByQuery{
      vars: ["session_group","session_role"],
      query: sparql_query_for_access_role( group_string ) }
  end

  defp sparql_query_for_access_role( group_string ) do
    "PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    SELECT DISTINCT ?session_group ?session_role WHERE {
      <SESSION_ID> ext:sessionGroup/mu:uuid ?session_group;
                   ext:sessionRole ?session_role.
      FILTER( ?session_role = \"#{group_string}\" )
    }"
  end

  def user_groups do
    [
      # // PUBLIC
      %GroupSpec{
        name: "public",
        useage: [:read],
        access: %AlwaysAccessible{}, # Needed for mock-login page
        graphs: [ %GraphSpec{
                    graph: "http://mu.semte.ch/graphs/public",
                    constraint: %ResourceConstraint{
                      resource_types: [
                        "http://xmlns.com/foaf/0.1/Person",
                        "http://xmlns.com/foaf/0.1/OnlineAccount",
                        "http://data.vlaanderen.be/ns/besluit#Bestuurseenheid",
                      ]
                    } },
                    %GraphSpec{
                      graph: "http://mu.semte.ch/graphs/sessions",
                      constraint: %ResourceFormatConstraint{
                        resource_prefix: "http://mu.semte.ch/sessions/"
                    } }
                ] },

      # // SUBSIDIES
      %GroupSpec{
        name: "o-subs-r",
        useage: [:read],
        access: access_by_role( "SubsidyDB-subsidies" ),
        graphs: [ %GraphSpec{
                    graph: "http://mu.semte.ch/graphs/organizations/",
                    constraint: %ResourceConstraint{
                      resource_types: [
                        "http://www.w3.org/2004/02/skos/core#ConceptScheme",
                        "http://www.w3.org/2004/02/skos/core#Concept",
                        "http://lblod.data.gift/vocabularies/subsidie/SubsidiemaatregelConsumptieStatus",
                        "http://data.vlaanderen.be/ns/subsidie#SubsidiemaatregelAanbod",
                        "http://lblod.data.gift/vocabularies/subsidie/SubsidiemaatregelAanbodReeks",
                        "http://lblod.data.gift/vocabularies/subsidie/ApplicationFlow",
                        "http://lblod.data.gift/vocabularies/subsidie/ApplicationStep",
                        "http://data.vlaanderen.be/ns/subsidie#Subsidieprocedurestap",
                        "http://data.europa.eu/m8g/PeriodOfTime",
                        "http://data.europa.eu/m8g/Criterion",
                        "http://data.europa.eu/m8g/RequirementGroup",
                        "http://data.europa.eu/m8g/CriterionRequirement",
                        "http://data.europa.eu/m8g/Requirement",
                        "http://xmlns.com/foaf/0.1/Document",
                        "http://www.w3.org/ns/org#Organization",
                      ] } } ] },

      %GroupSpec{
        name: "org",
        useage: [:read],
        access: %AccessByQuery{
          vars: ["session_group"],
          query: "PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
                  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
                  SELECT ?session_group ?session_role WHERE {
                    <SESSION_ID> ext:sessionGroup/mu:uuid ?session_group.
                    }" },
        graphs: [ %GraphSpec{
                    graph: "http://mu.semte.ch/graphs/organizations/",
                    constraint: %ResourceConstraint{
                      resource_types: [
                        "http://xmlns.com/foaf/0.1/Person",
                        "http://xmlns.com/foaf/0.1/OnlineAccount",
                        "http://www.w3.org/ns/adms#Identifier",
                      ] } } ] },

      # // CLEANUP
      #
      %GraphCleanup{
        originating_graph: "http://mu.semte.ch/application",
        useage: [:write],
        name: "clean"
      }
    ]
  end
end
