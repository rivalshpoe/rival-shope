using Store.Domain.Entities;

namespace Store.UnitTests.Domain;

public class DeviceTests
{
    private static readonly DateTime Now = new(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Device_is_auto_blocked_on_fifth_fake_order()
    {
        var device = new Device { DeviceHash = "abc" };

        for (var i = 1; i <= 4; i++)
        {
            Assert.False(device.RegisterFakeOrder(Now.AddMinutes(i)));
            Assert.False(device.IsBlocked);
            Assert.Equal(i, device.FakeOrderCount);
        }

        var blockedNow = device.RegisterFakeOrder(Now.AddMinutes(5));

        Assert.True(blockedNow);
        Assert.True(device.IsBlocked);
        Assert.Equal(Device.AutoBlockThreshold, device.FakeOrderCount);
        Assert.Equal(Now.AddMinutes(5), device.BlockedAt);
        Assert.Contains("5", device.BlockedReason);
    }

    [Fact]
    public void Further_fake_orders_do_not_report_a_new_block()
    {
        var device = new Device();
        for (var i = 0; i < 5; i++) device.RegisterFakeOrder(Now);
        Assert.False(device.RegisterFakeOrder(Now));
        Assert.Equal(6, device.FakeOrderCount);
        Assert.True(device.IsBlocked);
    }

    [Fact]
    public void Manual_unblock_clears_block_metadata_but_keeps_counter()
    {
        var device = new Device();
        for (var i = 0; i < 5; i++) device.RegisterFakeOrder(Now);

        device.Unblock(Now.AddHours(1));

        Assert.False(device.IsBlocked);
        Assert.Null(device.BlockedAt);
        Assert.Null(device.BlockedReason);
        Assert.Equal(5, device.FakeOrderCount);
    }

    [Fact]
    public void Manual_block_records_reason()
    {
        var device = new Device();
        device.Block(Now, "سلوك مشبوه");
        Assert.True(device.IsBlocked);
        Assert.Equal("سلوك مشبوه", device.BlockedReason);
        Assert.Equal(Now, device.BlockedAt);
    }
}
