import { Apollo, APOLLO_OPTIONS } from "apollo-angular";
import { HttpLink } from "apollo-angular/http";
import { ApplicationConfig, inject } from "@angular/core";
import { ApolloClientOptions, InMemoryCache } from "@apollo/client/core";
import { environment } from "../environments/environment";

export function apolloOptionsFactory(): ApolloClientOptions<any> {
  const httpLink = inject(HttpLink);
  return {
    link: httpLink.create({ uri: environment.graphql_uri }),
    cache: new InMemoryCache(),
  };
}

export const graphqlProvider: ApplicationConfig["providers"] = [
  Apollo,
  {
    provide: APOLLO_OPTIONS,
    useFactory: apolloOptionsFactory,
  },
];
