"use client";

import Reply from "@/components/Post/Structure/Reply";
import Post from "@/components/Post/Structure/Index";
import { useQuery } from "@tanstack/react-query";
import { request, gql } from "graphql-request";
import Error from "@/components/Error";
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
        row_id
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

  const { data: specificPost, isLoading, isError } = useQuery({
    queryKey: ["specificPost", postId],
    queryFn: async () => {
      try {
        const response = await request("http://localhost:8080/v1/graphql/", CONTENT_POST, { id: postId });
        console.log("GraphQL response:", response); // Debug output
        return response.post.length > 0 ? response.post[0] : null; // Handle empty array case
      } catch (error) {
        console.error("Error fetching post:", error); // Log the error
        throw new Error("Error fetching post"); // Ensure isError is set to true
      }
    },
    enabled: !!postId,
  });

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message="An error occurred while fetching the post." />;
  }

  if (!specificPost) {
    return <Error message="The post does not exist or has been deleted." />;
  }

  return (
    <div className="container p-0 p-lg-1">
      <Post
        post={specificPost}
        index={0}
        isClickable={false}
      />
      <Reply postId={postId} postRowId={specificPost.row_id} />
    </div>
  );
}

export default ReadPost;
