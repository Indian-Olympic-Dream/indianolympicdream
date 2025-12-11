import { Injectable } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Embed } from "../models/app-models";

const GET_EMBEDS = gql`
  query YoutubeEmbeds($limit: Int, $page: Int) {
    Embeds(
      where: { platform: { equals: youtube } }
      limit: $limit
      page: $page
    ) {
      docs {
        id
        embedTitle
        embedDescription
        url
        platform
        tags {
          name
        }
      }
      totalDocs
      limit
      totalPages
      page
    }
  }
`;

@Injectable({
  providedIn: "root",
})
export class ExploreService {
  constructor(private apollo: Apollo) {}

  getEmbeds(limit: number = 20, page: number = 1): Observable<Embed[]> {
    return this.apollo
      .watchQuery<{ Embeds: { docs: Embed[] } }>({
        query: GET_EMBEDS,
        variables: {
          limit,
          page,
        },
      })
      .valueChanges.pipe(map((result) => result.data.Embeds.docs));
  }
}
