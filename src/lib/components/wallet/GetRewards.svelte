<script lang="ts">
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";
  import { checkUniapp, checkPlatform } from "$lib/utils";
  import ModelDeSelector from "$lib/components/chat/ModelDeSelector.svelte";

  import {
    chats,
    user,
    showShareModal,
    showRewardsHistoryModal,
    showRewardDetailModal,
    showDownLoad,
    mobile,
  } from "$lib/stores";

  import { clockIn, getRewardsCount } from "$lib/apis/rewards/index.js";

  import DownLoadModal from "$lib/components/download/DownLoadModal.svelte";

  const i18n = getContext("i18n");

  let clockLoading = false;

  let items = [
    {
      id: "clock_in",
      text: "Clock In",
      reward: "3000 DGC",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M4 19q-.825 0-2.125-.875T2 17V5q0-.825.588-1.412T4 3h16q.825 0 1.413.588T22 5v12q0 .825-.587 1.413T20 19h-4v1q0 .425-.288.713T15 21H9q-.425 0-.712-.288T8 20v-1zm0-2h16V5H4zm0 0V5zm4-2h8v-.55q0-1.125-1.1-1.787T12 12t-2.9.663T8 14.45zm4-4q.825 0 1.413-.587T14 9t-.587-1.412T12 7t-1.412.588T10 9t.588 1.413T12 11"/></svg>',
    },
    {
      id: "invite",
      text: "Share",
      reward: "6000 DGC",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M18 22q-1.25 0-2.125-.875T15 19q0-.175.025-.363t.075-.337l-7.05-4.1q-.425.375-.95.588T6 15q-1.25 0-2.125-.875T3 12t.875-2.125T6 9q.575 0 1.1.213t.95.587l7.05-4.1q-.05-.15-.075-.338T15 5q0-1.25.875-2.125T18 2t2.125.875T21 5t-.875 2.125T18 8q-.575 0-1.1-.212t-.95-.588L8.9 11.3q.05.15.075.338T9 12t-.025.363t-.075.337l7.05 4.1q.425-.375.95-.587T18 16q1.25 0 2.125.877T21 19t-.875 2.125T18 22"/></svg>',
    },
  ];

  let rewardsCount: any = {};

  async function getCount() {
    if ($user) {
      const res = await getRewardsCount(localStorage.token);
      if (res) {
        Object.keys(res).forEach((key) => {
          if (res[key]) {
            rewardsCount[key] = res[key].length;
          } else {
            rewardsCount[key] = 0;
          }          
        });
        console.log("rewardsCount", rewardsCount);
      }
    }
  }

  $: if ($user?.id?.startsWith("0x")) {
    getCount();
  }
</script>

<div>
  <div class="flex flex-wrap lg:justify-between">
    {#each items as item, index}
      {#if (item.id !== "new_wallet" && $user?.id?.startsWith("0x")) || (item.id === "new_wallet" && !$user?.id?.startsWith("0x"))}
        <div
          class="flex direction-column justify-center gap-2 w-full lg:w-2/5 lg:px-2 mb-2 text-xs lg:text-sm break-normal"
        >
          <div
            class="flex justify-start items-center gap-2 w-[180px] lg:w-auto"
          >
            {@html item.icon}
            <span>{$i18n.t(item.text)}</span>
          </div>
          <div
            class="px-4 py-2 primaryButton text-gray-100 transition rounded-lg flex justify-between items-center"
          >
            <span class="relative">{item.reward}</span>
            <button
              disabled={clockLoading}
              class={"px-2 lg:px-3.5 py-1 dark:bg-white dark:text-zinc-950 bg-white text-zinc-950 transition rounded-lg break-words"}
              style={clockLoading && item.id === "clock_in"
                ? "background: rgba(251, 251, 251, 0.8)"
                : ""}
              on:click={async () => {
                console.log("user info ", $user);

                if (item.id === "invite") {
                  $showShareModal = true;
                } else if (item.id === "clock_in") {
                  if ($chats.length > 0) {
                    clockLoading = true;
                    await clockIn(localStorage.token)
                      .then((res) => {
                        console.log("Clock In  res", res);
                        getCount();
                        if (res?.ok) {
                          toast.success($i18n.t(res?.message));
                        }
                        if (res?.detail) {
                          toast.warning($i18n.t(res?.detail));
                        }
                      })
                      .catch((res) => {
                        console.log("Clock In  error", res);
                      });
                    clockLoading = false;
                  } else {
                    toast.warning(
                      $i18n.t(
                        "You need to complete a conversation to receive a reward ！"
                      )
                    );
                  }
                }
                return;
              }}
            >
              {(($user?.id.startsWith("0x") && rewardsCount[item.id]) || 0) > 0
                ? clockLoading && item.id === "clock_in"
                  ? $i18n.t("Done...")
                  : $i18n.t("Done")
                : clockLoading && item.id === "clock_in"
                ? $i18n.t("Get Now...")
                : $i18n.t("Get Now!")}
            </button>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>

<DownLoadModal bind:show={$showDownLoad} />

<style>
  .mt-20 {
    margin-top: 20px;
  }
  .mr-10 {
    margin-right: 10px;
  }
  .direction-column {
    flex-direction: column;
  }
  .region-text-color {
    color: rgba(184, 142, 86, 1);
  }
</style>
