"use client";

import Post from '@/components/Post/Structure/Index';
import { useQuery } from '@tanstack/react-query';
import { request, gql } from 'graphql-request';
import { useParams } from 'next/navigation';
import Loading from "@/components/Loading";
import PageTitle from '@/components/Title';
import Error from '@/components/Error';
import React from 'react';

const MyPosts = () => {
  const PERSONAL_POSTS = gql`
    query GetPosts($authorAddress: String!) {
      post(where: { author_address: { _eq: $authorAddress } }) {
        text
        id
        owner_address
        row_id
        subspace_section {
          name
          id
        }
        post_urls {
          url
        }
      }
    }
  `;

  const { authorAddress } = useParams();

  const { data: personalPosts, isLoading, isError } = useQuery({
    queryKey: ['personalPost', authorAddress],
    queryFn: async () => {
      if (!authorAddress) return [];
      const data = await request('http://localhost:8080/v1/graphql/', PERSONAL_POSTS, { authorAddress });
      return data.post;
    },
    enabled: !!authorAddress,
  });

  if (isLoading) return <Loading />;
  if (isError) return <Error message="Error fetching personal post data." />;
  if (personalPosts?.length === 0) return <Error message="No personal posts found." />;

  return (
    <div className="container p-0 p-lg-1">
      <PageTitle title="My posts" />
      <ul className="list-unstyled">
        {personalPosts?.map((post, index) => (
          <Post
            post={post}
            post_page={false}
            index={index}
            key={index}
            isClickable={true}
            />
        ))}
      </ul>
    </div>
  );
};

export default MyPosts;
