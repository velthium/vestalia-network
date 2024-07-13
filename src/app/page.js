"use client";

import Post from "@/components/Post/Structure/Index";
import { useQuery } from "@tanstack/react-query";
import { request, gql } from "graphql-request";
import Error from "@/components/Alert/Error";
import Loading from "@/components/Loading";
import React from "react";

function HomePage() {
  const POSTS_AND_SECTIONS_QUERY = gql`
      query GetPostsAndSections {
        post(where: { text: { _is_null: false } }) {
          id
          text
          owner_address
          row_id
          subspace_section {
            name
            id
          }
          reactions {
            id
            value
            post_row_id
          }
          post_urls {
            url
          }
        }
        subspace_section {
          name
          id
        }
      }
  `;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["postHomepage"],
    queryFn: async () => request("http://localhost:8080/v1/graphql/", POSTS_AND_SECTIONS_QUERY)
  });

  if (isLoading) return <Loading />;
  if (isError) return <Error message="Error fetching posts and communites." />;

  return (
    <div className="container p-0 p-lg-1">
      <article className="d-flex overflow-x-scroll mb-4">
        {data.subspace_section.map((community, index) => (
          <div
            key={index}
            className="card m-2 flex-shrink-0">
            <a
              className="text-decoration-none"
              href={`/community/${community.id}/${community.name.replace(/\s/g, "")}`}>
              <div className="card-body py-1">
                <h1 className="h7 card-title custom-orange fw-bold">{community.name}</h1>
              </div>
            </a>
          </div>
        ))}
      </article>
      <article>
        {data.post.map((post, index) => (
          <Post
            key={post.id}
            post={post}
            index={index}
            isClickable={true}
          />
        ))}
      </article>
    </div>
  );
}

export default HomePage;