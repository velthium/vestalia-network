"use client";

import Reply from "@/components/Post/Structure/Reply";
import Post from "@/components/Post/Structure/Index";
import { useQuery } from "@tanstack/react-query";
import { request, gql } from "graphql-request";
import Error from "@/components/Alert/Error";
import { useParams } from 'next/navigation';
import Loading from "@/components/Loading";
import React from "react";

function ReadPost() {
  const { postId } = useParams();

  const CONTENT_POST = gql`
    query getPost($id: bigint!) {
      post(where: { id: { _eq: $id }, text: { _is_null: false } }) {
        id
        text
        owner_address
        subspace_section {
          name
          id
        }
        post_urls {
          url
        }
        reactions {
          id
          value
          post_row_id
        }
      }
    }
  `;

  // Fetch specific post with its id
  const { data: specificPost, isLoading, isError } = useQuery({
    queryKey: ["specificPost", postId],
    queryFn: async () => request("http://localhost:8080/v1/graphql/", CONTENT_POST, { id: postId }).then(res => res.post[0]),
    enabled: !!postId,
  });

  if (isLoading) return <Loading />;
  if (isError) return <Error message="Error fetching post." />;

  return (
    <div className="container p-0 p-lg-1">
      <Post
        post={specificPost}
        index={0}
        from_page="post_page" />
      <Reply postId={postId} />
    </div>
  );
}

export default ReadPost;
