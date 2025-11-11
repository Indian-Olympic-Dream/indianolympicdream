import { Injectable } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface Story {
  id: string;
  slug: string;
  title: string;
  readingTime: number;
  authors: {
    firstName: string;
    lastName: string;
    avatar: {
      alt: string;
      sizes: {
        square: {
          url: string;
        };
      };
    };
  }[];
  heroImage: {
    alt: string;
    sizes: {
      card: {
        url: string;
      };
    };
  };
}

const GET_STORIES_LIST = gql`
  query StoriesListHome {
    Stories(where: { status: { equals: published } }) {
      docs {
        id
        slug
        title
        readingTime
        authors {
          firstName
          lastName
          avatar {
            alt
            sizes {
              square {
                url
              }
            }
          }
        }
        heroImage {
          alt
          sizes {
            card {
              url
            }
          }
        }
      }
    }
  }
`;

@Injectable({
  providedIn: "root",
})
export class StoriesService {
  constructor(private apollo: Apollo) {}

  getStories(): Observable<Story[]> {
    return this.apollo
      .watchQuery<{ Stories: { docs: Story[] } }>({
        query: GET_STORIES_LIST,
        fetchPolicy: "no-cache",
      })
      .valueChanges.pipe(map((result) => result.data.Stories.docs));
  }
}
