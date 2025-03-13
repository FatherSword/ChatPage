### The data structure

### --- for src/lib/store/index.ts

1.WEBUI_NAME: 这是一个可写的字符串类型的状态存储，初始值为APP_NAME，用于存储应用的名称。当应用名称发生变化时，可以通过.set方法更新这个值。

2.config: 用于存储应用的配置信息，是一个可写的对象类型的状态存储，初始值为undefined。该对象可能包含应用的状态、名称、版本、默认语言、是否支持图片、默认模型、默认提示建议等信息。

3.user: 用于存储当前登录用户的会话信息，是一个可写的对象类型的状态存储，初始值为undefined。该对象包含用户的ID、电子邮件、用户名、角色、头像URL、地址类型、是否验证、是否是Pro用户、Pro服务的结束日期等信息。

4.MODEL_DOWNLOAD_POOL: 用于存储模型下载的信息，是一个可写的对象类型的状态存储，初始值为空对象。这个对象可能用于跟踪哪些模型正在下载。

5.mobile: 用于存储一个布尔值，表示当前设备是否是移动设备。初始值为false。

6.theme: 用于存储当前应用的主题，初始值为'light'。可以是'light'或'dark'两种主题之一。

7.chatId: 用于存储当前聊天的ID，初始值为空字符串。

8.chats: 用于存储所有聊天会话的列表，初始值为空数组。每个聊天会话可能包含ID、参与用户、时间戳、消息内容等信息。

9.tags: 用于存储聊天标签的列表，初始值为空数组。标签可能用于对聊天进行分类或组织。

10.models: 用于存储可用模型的列表，初始值为空数组。每个模型可以是OpenAIModel或OllamaModel类型，这两种类型都是对象，都包含id和name属性。   OllamaModel类型还包括一些Ollama特有的字段，如details、size、description、model、modified_at和dist。

11.modelfiles: 用于存储模型文件的相关信息，初始值为空数组。这些文件可能是模型的权重文件或者配置文件等。

12.prompts: 用于存储聊天提示的列表，初始值为空数组。每个提示可能包含命令、用户ID、标题、内容和时间戳等信息。

13.documents: 用于存储文档的列表，初始值包含两个示例文档。每个文档可能包含集合名称、文件名、名称、标题等信息。

14.settings: 用于存储应用的各种设置偏好，是一个可写的对象类型的状态存储，初始值为空对象。设置可能包括使用的模型列表、会话模式、语音自动发送、响应自动播放、音频设置、显示用户名、保存聊天历史、通知启用、标题设置、拆分大增量、聊天方向、系统设置、请求格式、保持连接、种子、温度、重复惩罚、top_k、top_p、num_ctx以及选项等。

15.showSidebar: 用于存储一个布尔值，表示侧边栏是否显示。初始值为false。

16.showSettings: 用于存储一个布尔值，表示设置面板是否显示。初始值为false。

17.showArchivedChats: 用于存储一个布尔值，表示归档聊天是否显示。初始值为false。

18.showChangelog: 用于存储一个布尔值，表示变更日志是否显示。初始值为false。

19.showNewWalletModal、showOpenWalletModal、showExportWalletJsonModal、showTransferModal、showShowModal、showBuyCoinModal、showShareModal、showRewardsModal、showRewardsHistoryModal、showRewardDetailModal、showTransactionsModal、showUserVerifyModal、showConfirmUpgradeModal、showCoinIntruModal、showFollowTwitterModal、showFollowTGGroupModal: 这些都是用于存储布尔值的状态，表示相应的模态框（Modal）是否显示。初始值为false。

20.showCoinIntruType: 用于存储一个字符串，表示当前显示的硬币介绍的类型，初始值为'dgc'。

21.dbcRate: 用于存储一个对象，表示DBC的汇率及其更新时间，初始值为{rate: 0.0002, time: ''}。

22.initPageFlag: 用于存储一个布尔值，表示页面是否初始化完成。初始值为false。

23.showDownLoad: 用于存储一个布尔值，表示下载面板是否显示。初始值为false。

24.deApiBaseUrl: 用于存储默认的API请求地址，初始值为{name: 'America', url: 'https://usa-chat.degpt.ai/api'}。该对象包含一个名称和一个URL。

25.currentWalletData: 用于存储当前钱包的数据，初始值为DefaultCurrentWalletData。这个对象可能包含钱包的余额、地址、交易记录等信息。

26.threesideAccount: 用于存储三边账户的数据，初始值为空对象。这个账户可能是应用中用于特定功能（如三边交易）的账户。

27.modelLimits: 用于存储每个模型的访问限制，初始值包含四个示例模型及其访问次数。每个模型限制对象包含模型名称name和访问次数num。

28.pageUpdateNumber: 用于存储页面更新的次数，初始值为0。这个数值可能用于跟踪页面的更新状态。

29.inviterId: 用于存储邀请者的ID，初始值为空字符串。

30.channel: 用于存储来源渠道的标识符，初始值为空字符串。