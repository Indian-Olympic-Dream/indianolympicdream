import { Injectable } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface TextBlock {
  __typename: "Text";
  text: string;
}

export interface BlockquoteBlock {
  __typename: "Blockquote";
  quote: string;
  citation: string;
}

export type SubtitleBlock = TextBlock | BlockquoteBlock;

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle?: SubtitleBlock[];
  publishedDate?: string;
  readingTime: number;
  tags?: {
    name: string;
  }[];
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
  chapters?: {
    id: string;
    slug: string;
    title: string;
    heroImage: {
      alt: string;
      sizes: {
        card: {
          url: string;
        };
      };
    };
    author: {
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
    };
    tags: {
      name: string;
    }[];
  }[];
  heroImage: {
    alt: string;
    url?: string;
    sizes: {
      card: {
        url: string;
      };
      thumbnail?: {
        url: string;
      };
    };
  };
  content?: any;
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

const GET_STORY_BY_SLUG = gql`
  query StoriesDetail($slug: String!) {
    Stories(where: { slug: { equals: $slug } }) {
      docs {
        id
        title
        heroImage {
          alt
          sizes {
            full {
              url
            }
            thumbnail {
              url
            }
            card {
              url
            }
          }
        }
        subtitle {
          ... on Text {
            text
          }
          ... on Blockquote {
            quote
            citation
            blockType
          }
        }
        publishedDate
        readingTime
        tags {
          name
        }
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
        content {
          ... on RichText {
            blockType
            content
          }
          ... on Image {
            blockType
            image {
              alt
              sizes {
                full {
                  url
                }
                card {
                  url
                }
              }
            }
            caption
            imageLayout: layout
          }
          ... on PullQuote {
            blockType
            quote
          }
          ... on Blockquote {
            blockType
            quote
            citation
          }
          ... on Embed {
            blockType
            url
            platform
          }
          ... on MapBlock {
            blockType
            center
            zoom
            caption
            location {
              id
              name
              position
            }
          }
          ... on MediaTextLayout {
            blockType
            media {
              alt
              sizes {
                card {
                  url
                }
              }
            }
            text
            mediaTextLayout: layout
          }
          ... on ImageGallery {
            blockType
            galleryCaption
            images {
              alt
              description
              credits
              sizes {
                card {
                  url
                }
              }
            }
          }
          ... on EssayBlock {
            blockType
            essay {
              id
              title
            }
          }
        }

        chapters {
          id
          slug
          title
          readingTime
          heroImage {
            alt
            sizes {
              card {
                url
              }
            }
          }
          author {
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
          tags {
            name
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

  getStoryBySlug(slug: string): Observable<Story> {
    return this.apollo
      .watchQuery<{ Stories: { docs: Story[] } }>({
        query: GET_STORY_BY_SLUG,
        variables: {
          slug: slug,
        },
        fetchPolicy: "no-cache",
      })
      .valueChanges.pipe(map((result) => result.data.Stories.docs[0]));
  }
}
