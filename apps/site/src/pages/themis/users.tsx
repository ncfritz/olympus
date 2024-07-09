import {
  HomeOutlined,
  RadarChartOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Breadcrumb, Button, Drawer, Layout, Space } from "antd";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import themisApi from "../../api/themisApi";
import AddUserPanel from "../../components/themis/AddUserPanel";
import UsersTable from "../../components/themis/UsersTable";
import type { BasicUserInfo } from "../../types/themis";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const [newUserDrawerOpen, setNewUserDrawerOpen] = useState(false);
  const [users, setUsers] = useState<BasicUserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(false);

  const loadUsers = async (quiet: boolean = false) => {
    if (!quiet) {
      setUsersLoading(true);
    }

    setUsersError(false);

    try {
      const usersResponse = await themisApi.listUsers();
      setUsers(usersResponse.users);
    } catch (e) {
      setUsersError(true);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadUsers();
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
                  <UsergroupAddOutlined />
                  <span>Users</span>
                </Space>
              ),
            },
          ]}
        />
        <Button
          size={"small"}
          onClick={() => {
            setNewUserDrawerOpen(true);
          }}
          icon={<UsergroupAddOutlined />}
          type={"text"}
        >
          Add user
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
          <UsersTable users={users} loading={usersLoading} />
        </Content>
        <Drawer
          title={"Add user"}
          width={500}
          open={newUserDrawerOpen}
          onClose={() => {
            setNewUserDrawerOpen(false);
          }}
        >
          <AddUserPanel
            close={() => {
              setNewUserDrawerOpen(false);
            }}
            afterAdd={async () => {
              await loadUsers(true);
            }}
          />
        </Drawer>
      </Content>
    </>
  );
};

export default IndexPage;
