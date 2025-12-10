import { Injectable } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Podcast } from "../models/app-models";

const GET_PODCASTS = gql`
  query Podcasts($limit: Int, $page: Int) {
    Podcasts(limit: $limit, page: $page) {
      docs {
        id
        title
        description
        youtubeURL
        duration
        coverImage {
          url
          alt
        }
      }
      totalDocs
      limit
      totalPages
      page
      hasPrevPage
      hasNextPage
    }
  }
`;

@Injectable({
  providedIn: "root",
})
export class OriginalsService {
  constructor(private apollo: Apollo) {}

  getPodcasts(limit: number = 10, page: number = 1): Observable<Podcast[]> {
    return this.apollo
      .watchQuery<{ Podcasts: { docs: Podcast[] } }>({
        query: GET_PODCASTS,
        variables: {
          limit,
          page,
        },
      })
      .valueChanges.pipe(map((result) => result.data.Podcasts.docs));
  }
}
