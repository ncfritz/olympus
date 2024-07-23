import {
  CalendarOutlined,
  FolderAddOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { Breadcrumb, Button, Drawer, Layout, Space } from "antd";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import themisApi from "../../api/themisApi";
import AddReviewYearPanel from "../../components/themis/AddReviewYearPanel";
import ReviewYearsTable from "../../components/themis/ReviewYearsTable";
import type { ReviewYear } from "../../types/themis";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const [newReviewDrawerOpen, setNewReviewDrawerOpen] = useState(false);
  const [reviews, setReviews] = useState<ReviewYear[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);

  const loadReviewYears = async (quiet: boolean = false) => {
    if (!quiet) {
      setReviewsLoading(true);
    }

    setReviewsError(false);

    try {
      const reviewYearsResponse = await themisApi.getReviewYears();
      setReviews(reviewYearsResponse.reviews);
    } catch (e) {
      setReviewsError(true);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadReviewYears();
    })();
  }, []);

  return (
    <>
      <Space
        direction={"horizontal"}
        style={{
          padding: 8,
          background: "#f6f6f6",
          position: "fixed",
          zIndex: 1000,
          justifyContent: "space-between",
          alignItems: "center",
          width: "calc(100% - 380px)",
        }}
      >
        <Breadcrumb
          items={[
            {
              title: (
                <Link href={"/"}>
                  <Space size={4}>
                    <HomeOutlined />
                    <span>Home</span>
                  </Space>
                </Link>
              ),
            },
            {
              title: (
                <Link href={"/themis"}>
                  <Space size={4}>
                    <RadarChartOutlined />
                    <span>Themis</span>
                  </Space>
                </Link>
              ),
            },
            {
              title: (
                <Space size={4}>
                  <CalendarOutlined />
                  <span>Reviews</span>
                </Space>
              ),
            },
          ]}
        />
        <Button
          size={"small"}
          onClick={() => {
            setNewReviewDrawerOpen(true);
          }}
          icon={<FolderAddOutlined />}
          type={"text"}
        >
          Add review year
        </Button>
      </Space>
      <Content
        style={{
          paddingTop: 41,
          background: "#fff",
        }}
      >
        <Content
          style={{
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          <ReviewYearsTable reviews={reviews} loading={reviewsLoading} />
        </Content>
        <Drawer
          title={"Add review year"}
          width={500}
          open={newReviewDrawerOpen}
          onClose={() => {
            setNewReviewDrawerOpen(false);
          }}
        >
          <AddReviewYearPanel
            existingYears={reviews.map((review) => {
              return review.year;
            })}
            close={() => {
              setNewReviewDrawerOpen(false);
            }}
            afterAdd={async () => {
              await loadReviewYears(true);
            }}
          />
        </Drawer>
      </Content>
    </>
  );
};

export default IndexPage;
