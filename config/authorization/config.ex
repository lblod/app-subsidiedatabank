alias Acl.Accessibility.Always, as: AlwaysAccessible
alias Acl.Accessibility.ByQuery, as: AccessByQuery
alias Acl.GraphSpec.Constraint.Resource, as: ResourceConstraint
alias Acl.GraphSpec, as: GraphSpec
alias Acl.GroupSpec, as: GroupSpec
alias Acl.GroupSpec.GraphCleanup, as: GraphCleanup

defmodule Acl.UserGroups.Config do
  def user_groups do
    # These elements are walked from top to bottom.  Each of them may
    # alter the quads to which the current query applies.  Quads are
    # represented in three sections: current_source_quads,
    # removed_source_quads, new_quads.  The quads may be calculated in
    # many ways.  The useage of a GroupSpec and GraphCleanup are
    # common.
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
                        "http://lblod.data.gift/vocabularies/subsidie/ApplicationForm",
                        "http://data.vlaanderen.be/ns/subsidie#SubsidiemaatregelConsumptie",
                        "http://lblod.data.gift/vocabularies/subsidie/SubsidiemaatregelConsumptieStatus",
                        "http://data.vlaanderen.be/ns/subsidie#SubsidiemaatregelAanbod",
                        "http://lblod.data.gift/vocabularies/subsidie/SubsidiemaatregelAanbodReeks",
                        "http://lblod.data.gift/vocabularies/subsidie/ApplicationFlow",
                        "http://lblod.data.gift/vocabularies/subsidie/ApplicationStep",
                        "http://data.vlaanderen.be/ns/subsidie#Subsidieprocedurestap",
                        "http://www.w3.org/2004/02/skos/core#Concept",
                        "http://data.europa.eu/m8g/Participation",
                      ]
                    } } ] },
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
